package main

import (
	"context"
	"errors"
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
		if err := runCommand(db, os.Args[1], os.Args[2:]); err != nil {
			log.Fatal(err)
		}
		return
	}
	delivery, err := configureResend()
	if err != nil {
		log.Fatal(err)
	}
	mux := http.NewServeMux()
	catalogRoutes(mux, db)
	authRoutes(mux, db, delivery)
	panelRoutes(mux, db)
	publicBookingRoutes(mux, db, delivery)
	mediaRoutes(mux, db)
	analyticsRoutes(mux, db)
	orderRoutes(mux, db)
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		sqlDB, err := db.DB()
		if err == nil {
			err = sqlDB.PingContext(ctx)
		}
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
	server := http.Server{Addr: addr, Handler: noStore(mux), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 2 * time.Minute}
	stop, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	if delivery != nil {
		go startReminderWorker(stop, db, delivery)
	}
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
