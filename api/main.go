package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("Configurá DATABASE_URL para PostgreSQL")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		log.Fatal("No se pudo conectar a PostgreSQL")
	}
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "init":
			err = db.AutoMigrate(&shop{}, &product{}, &reservation{})
			if err == nil {
				err = migrateAuth(db)
			}
			if err == nil && len(os.Args) == 3 {
				err = importCatalog(db, os.Args[2])
			}
			if err == nil {
				err = seed(db)
			}
		case "crear-vendedor":
			err = createSeller(db, os.Args[2:])
		case "reservar":
			err = reserveCommand(db, os.Args[2:])
		default:
			err = fmt.Errorf("comando desconocido")
		}
		if err != nil {
			log.Fatal(err)
		}
		return
	}
	mux := http.NewServeMux()
	delivery, err := configureResend()
	if err != nil {
		log.Fatal(err)
	}
	authRoutes(mux, db, delivery)
	mux.HandleFunc("GET /api/shops/{slug}", func(w http.ResponseWriter, r *http.Request) {
		slug := r.PathValue("slug")
		var s shop
		err := db.WithContext(r.Context()).Preload("Products", func(q *gorm.DB) *gorm.DB { return q.Order("position, slug") }).Where(map[string]any{"slug": slug}).First(&s).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			http.NotFound(w, r)
			return
		}
		if err != nil {
			log.Print(err)
			http.Error(w, "No se pudo cargar la tienda", 500)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(s)
	})
	server := http.Server{Addr: "127.0.0.1:8080", Handler: mux, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second}
	log.Printf("API PostgreSQL en %s", server.Addr)
	log.Fatal(server.ListenAndServe())
}
