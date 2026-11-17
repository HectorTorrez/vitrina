package main

import (
	"errors"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"os"
	"testing"
	"time"
)

func TestBookingConcurrency(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set TEST_DATABASE_URL to an initialized PostgreSQL test database")
	}
	db, err := gorm.Open(postgres.Open(dsn))
	if err != nil {
		t.Fatal(err)
	}
	slug := "test-" + time.Now().UTC().Format("20060102150405.000000000")
	if err := db.Create(&shop{Slug: slug}).Error; err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		for _, model := range []any{&reservation{}, &product{}} {
			db.Where(map[string]any{"shop_slug": slug}).Delete(model)
		}
		db.Delete(&shop{Slug: slug})
	})
	for _, id := range []string{"gel", "clasica"} {
		if err := db.Create(&product{ShopSlug: slug, Slug: id, Kind: "service", DurationMinutes: 45, Available: true}).Error; err != nil {
			t.Fatal(err)
		}
	}
	start := time.Now().UTC().Add(time.Hour).Truncate(time.Minute)
	results := make(chan error, 2)
	gate := make(chan struct{})
	for _, id := range []string{"gel", "clasica"} {
		go func() { <-gate; _, err := book(db, slug, id, start, "Prueba"); results <- err }()
	}
	close(gate)
	a, b := <-results, <-results
	if !(a == nil && errors.Is(b, errOccupied) || b == nil && errors.Is(a, errOccupied)) {
		t.Fatalf("concurrent results: %v, %v", a, b)
	}
	if _, err = book(db, slug, "gel", start.Add(15*time.Minute), "Prueba"); !errors.Is(err, errOccupied) {
		t.Fatalf("overlap: %v", err)
	}
	if _, err = book(db, slug, "gel", start.Add(45*time.Minute), "Prueba"); err != nil {
		t.Fatalf("adjacent: %v", err)
	}
}
