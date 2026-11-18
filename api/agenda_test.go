package main

import (
	"errors"
	"testing"
	"time"
)

func TestBookingConcurrency(t *testing.T) {
	db := testDB(t)
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
		go func() { <-gate; _, err := saveBooking(db, slug, id, start, "Prueba", "", 0); results <- err }()
	}
	close(gate)
	a, b := <-results, <-results
	if !(a == nil && errors.Is(b, errOccupied) || b == nil && errors.Is(a, errOccupied)) {
		t.Fatalf("concurrent results: %v, %v", a, b)
	}
	if _, err := saveBooking(db, slug, "gel", start.Add(15*time.Minute), "Prueba", "", 0); !errors.Is(err, errOccupied) {
		t.Fatalf("overlap: %v", err)
	}
	if _, err := saveBooking(db, slug, "gel", start.Add(45*time.Minute), "Prueba", "", 0); err != nil {
		t.Fatalf("adjacent: %v", err)
	}
}
