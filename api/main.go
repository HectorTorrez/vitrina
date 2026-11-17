package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
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
		case "crear-operador":
			err = grantPanelAccess(db, os.Args[2:], true)
		case "asignar-tienda":
			err = grantPanelAccess(db, os.Args[2:], false)
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
	panelRoutes(mux, db)
	publicBookingRoutes(mux, db, delivery)
	mediaRoutes(mux, db)
	mux.HandleFunc("GET /api/shops", func(w http.ResponseWriter, r *http.Request) {
		type entry struct {
			Slug        string   `json:"slug"`
			Name        string   `json:"name"`
			Description string   `json:"description"`
			Theme       string   `json:"theme"`
			Products    []string `json:"products"`
		}
		var shops []shop
		err := db.WithContext(r.Context()).Preload("Products", func(q *gorm.DB) *gorm.DB {
			return q.Select("shop_slug", "slug").Where("hidden = ?", false).Order("position, slug")
		}).Order("name, slug").Find(&shops).Error
		if err != nil {
			log.Print(err)
			http.Error(w, "No se pudieron cargar las tiendas", 500)
			return
		}
		list := make([]entry, 0, len(shops))
		for _, s := range shops {
			// Shops appear in the directory once they publish something.
			if len(s.Products) == 0 {
				continue
			}
			e := entry{Slug: s.Slug, Name: s.Name, Description: s.Description, Theme: s.Theme, Products: []string{}}
			for _, p := range s.Products {
				e.Products = append(e.Products, p.Slug)
			}
			list = append(list, e)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(list)
	})
	mux.HandleFunc("GET /api/shops/{slug}", func(w http.ResponseWriter, r *http.Request) {
		slug := r.PathValue("slug")
		var s shop
		err := db.WithContext(r.Context()).Preload("Products", func(q *gorm.DB) *gorm.DB { return q.Where("hidden = ?", false).Order("position, slug") }).Where(map[string]any{"slug": slug}).First(&s).Error
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
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		sqlDB, err := db.DB()
		if err == nil {
			err = sqlDB.PingContext(ctx)
		}
		w.Header().Set("Cache-Control", "no-store")
		if err != nil {
			http.Error(w, "db", http.StatusServiceUnavailable)
			return
		}
		w.Write([]byte("ok"))
	})
	addr := os.Getenv("VITRINA_API_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8080"
	}
	server := http.Server{Addr: addr, Handler: mux, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 2 * time.Minute}
	stop, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	go func() {
		<-stop.Done()
		ctx, done := context.WithTimeout(context.Background(), 10*time.Second)
		defer done()
		server.Shutdown(ctx)
	}()
	log.Printf("API PostgreSQL en %s", server.Addr)
	if err := server.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
