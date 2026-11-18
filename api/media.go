package main

import (
	"crypto/rand"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"gorm.io/gorm"
)

const maxImageBytes = 5 << 20

var (
	mediaName    = regexp.MustCompile(`^[a-z0-9]{26}\.(jpg|png|webp|gif)$`)
	imageTypes   = map[string]string{"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}
	contentTypes = map[string]string{"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp", "gif": "image/gif"}
)

func uploadDir() string {
	if dir := os.Getenv("VITRINA_UPLOAD_DIR"); dir != "" {
		return dir
	}
	return "uploads"
}

func validMediaPath(path string) bool {
	name, ok := strings.CutPrefix(path, "/media/")
	return ok && mediaName.MatchString(name)
}

func mediaRoutes(mux *http.ServeMux, db *gorm.DB) {
	dir := uploadDir()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		log.Fatalf("No se pudo crear la carpeta de fotos %s: %v", dir, err)
	}

	mux.HandleFunc("POST /api/panel/images", authenticated(db, func(w http.ResponseWriter, r *http.Request, _ *gorm.DB, _ seller) {
		r.Body = http.MaxBytesReader(w, r.Body, maxImageBytes)
		data, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "La foto supera los 5 MB", http.StatusRequestEntityTooLarge)
			return
		}
		ext, ok := imageTypes[http.DetectContentType(data)]
		if !ok {
			http.Error(w, "Subí una foto JPG, PNG, WebP o GIF", http.StatusUnsupportedMediaType)
			return
		}
		name := strings.ToLower(rand.Text()) + "." + ext
		tmp, err := os.CreateTemp(dir, ".upload-*")
		if err == nil {
			_, err = tmp.Write(data)
			if closeErr := tmp.Close(); err == nil {
				err = closeErr
			}
			if err == nil {
				err = os.Rename(tmp.Name(), filepath.Join(dir, name))
			}
			if err != nil {
				os.Remove(tmp.Name())
			}
		}
		if err != nil {
			log.Print(err)
			http.Error(w, "No se pudo guardar la foto", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]string{"url": "/media/" + name})
	}))

	mux.HandleFunc("GET /api/media/{name}", func(w http.ResponseWriter, r *http.Request) {
		name := r.PathValue("name")
		if !mediaName.MatchString(name) {
			http.NotFound(w, r)
			return
		}
		file, err := os.Open(filepath.Join(dir, name))
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer file.Close()
		info, err := file.Stat()
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", contentTypes[name[strings.LastIndexByte(name, '.')+1:]])
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Content-Security-Policy", "default-src 'none'")
		http.ServeContent(w, r, "", info.ModTime(), file)
	})
}
