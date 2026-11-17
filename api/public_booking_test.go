package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func TestValidatedHours(t *testing.T) {
	if h, err := validatedHours(nil); err != nil || len(h) != 0 {
		t.Fatalf("nil hours: %v %v", h, err)
	}
	if _, err := validatedHours([]dayHours{{"09:00", "18:00"}}); err == nil {
		t.Fatal("expected error for incomplete week")
	}
	week := make([]dayHours, 7)
	if h, err := validatedHours(week); err != nil || len(h) != 0 {
		t.Fatalf("closed week should disable booking: %v %v", h, err)
	}
	week[1] = dayHours{"18:00", "09:00"}
	if _, err := validatedHours(week); err == nil {
		t.Fatal("expected error for inverted hours")
	}
	week[1] = dayHours{" 09:00", "18:00 "}
	if h, err := validatedHours(week); err != nil || h[1].Open != "09:00" {
		t.Fatalf("valid week: %v %v", h, err)
	}
}

func TestNormalizePhone(t *testing.T) {
	for input, want := range map[string]string{"+503 7000-0000": "50370000000", "(503) 7000.0000": "50370000000"} {
		if got, ok := normalizePhone(input); !ok || got != want {
			t.Fatalf("%q: got %q %v", input, got, ok)
		}
	}
	for _, input := range []string{"", "1234", "503-abc-0000", "+1234567890123456"} {
		if _, ok := normalizePhone(input); ok {
			t.Fatalf("%q should be invalid", input)
		}
	}
}

func TestPublicBooking(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set TEST_DATABASE_URL to an initialized PostgreSQL test database")
	}
	db, err := gorm.Open(postgres.Open(dsn))
	if err != nil {
		t.Fatal(err)
	}
	zone, err := time.LoadLocation(shopTimeZone)
	if err != nil {
		t.Fatal(err)
	}
	slug := "pub-" + strings.ReplaceAll(time.Now().UTC().Format("20060102150405.000000000"), ".", "")
	hours := make([]dayHours, 7)
	for i := range hours {
		hours[i] = dayHours{"09:00", "12:00"}
	}
	hours[0] = dayHours{}
	if err := db.Create(&shop{Slug: slug, Name: "Prueba", Theme: "arena", Hours: hours}).Error; err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		db.Where("shop_slug = ?", slug).Delete(&reservation{})
		db.Where("shop_slug = ?", slug).Delete(&product{})
		db.Delete(&shop{Slug: slug})
	})
	if err := db.Create(&product{ShopSlug: slug, Slug: "corte", Name: "Corte", Kind: "service", DurationMinutes: 60, Available: true, Options: []option{}}).Error; err != nil {
		t.Fatal(err)
	}

	// Next Monday at 08:00 shop time, so the whole day is in the future.
	now := time.Now().In(zone)
	monday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, zone).AddDate(0, 0, 1)
	for monday.Weekday() != time.Monday {
		monday = monday.AddDate(0, 0, 1)
	}
	var s shop
	db.Take(&s, "slug = ?", slug)
	var p product
	db.Take(&p, "shop_slug = ? AND slug = ?", slug, "corte")
	slots, err := openSlots(db, s, p, monday, now)
	if err != nil || len(slots) != 9 || slots[0].Format("15:04") != "09:00" || slots[8].Format("15:04") != "11:00" {
		t.Fatalf("monday slots: %v %v", slots, err)
	}
	if sunday, _ := openSlots(db, s, p, monday.AddDate(0, 0, -1), now); len(sunday) != 0 {
		t.Fatalf("sunday should be closed: %v", sunday)
	}

	mux := http.NewServeMux()
	publicBookingRoutes(mux, db, nil)
	post := func(input publicBookingInput, want int) {
		t.Helper()
		body, _ := json.Marshal(input)
		r := httptest.NewRequest(http.MethodPost, "/api/shops/"+slug+"/bookings", bytes.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		if w.Code != want {
			t.Fatalf("post %+v: got %d want %d: %s", input, w.Code, want, w.Body.String())
		}
	}
	day := monday.Format(publicDateLayout)
	booking := publicBookingInput{Service: "corte", StartsAt: day + "T09:00", Customer: "Ana", Phone: "+503 7000-0000"}
	post(booking, 201)
	post(booking, 400) // taken
	off := booking
	off.StartsAt, off.Phone = day+"T09:10", "50371111111"
	post(off, 400) // not on the 15-minute grid
	late := booking
	late.StartsAt, late.Phone = day+"T11:30", "50371111111"
	post(late, 400) // would end after closing
	second := booking
	second.StartsAt = day + "T10:00"
	post(second, 201)
	third := booking
	third.StartsAt = day + "T11:00"
	post(third, 400) // per-phone limit

	r := httptest.NewRequest(http.MethodGet, "/api/shops/"+slug+"/slots?service=corte&date="+day, nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, r)
	var got struct{ Slots []string }
	json.Unmarshal(w.Body.Bytes(), &got)
	if w.Code != 200 || len(got.Slots) != 1 || got.Slots[0] != "11:00" {
		t.Fatalf("slots after bookings: %d %v", w.Code, got.Slots)
	}
	var stored reservation
	if err := db.Take(&stored, "shop_slug = ? AND starts_at = ?", slug, slots[0]).Error; err != nil || stored.Phone != "50370000000" || stored.Source != "web" {
		t.Fatalf("stored booking: %+v %v", stored, err)
	}
	if _, _, err := bookPublic(db, slug, publicBookingInput{Service: "nada", StartsAt: day + "T11:00", Customer: "X", Phone: "50372222222"}, time.Now()); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("unknown service: %v", err)
	}
}
