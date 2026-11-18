package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
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
	for input, want := range map[string]string{
		"+503 7000-0000":  "50370000000",
		"(503) 7000.0000": "50370000000",
		"7000-0000":       "50370000000",
		"+1 555 010 0000": "15550100000",
	} {
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
	db := testDB(t)
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
	if err := db.Create(&product{ShopSlug: slug, Slug: "corte", Name: "Corte", Kind: "service", DurationMinutes: 60, Available: true}).Error; err != nil {
		t.Fatal(err)
	}

	mux := http.NewServeMux()
	publicBookingRoutes(mux, db, nil)
	slots := func(date string) []string {
		t.Helper()
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/shops/"+slug+"/slots?service=corte&date="+date, nil))
		var got struct{ Slots []string }
		if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &got) != nil {
			t.Fatalf("slots %s: %d %s", date, w.Code, w.Body.String())
		}
		return got.Slots
	}
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

	// Next Monday, so the whole day is in the future.
	monday := time.Now().In(shopZone).AddDate(0, 0, 1)
	for monday.Weekday() != time.Monday {
		monday = monday.AddDate(0, 0, 1)
	}
	day := monday.Format(localDate)
	if got := slots(day); len(got) != 9 || got[0] != "09:00" || got[8] != "11:00" {
		t.Fatalf("monday slots: %v", got)
	}
	if got := slots(monday.AddDate(0, 0, -1).Format(localDate)); len(got) != 0 {
		t.Fatalf("sunday should be closed: %v", got)
	}

	booking := publicBookingInput{Service: "corte", StartsAt: day + "T09:00", Customer: "Ana", Phone: "+503 7000-0000"}
	post(booking, 201)
	if err := db.Model(&reservation{}).Where("shop_slug = ? AND phone = ?", slug, "50370000000").Update("phone", "70000000").Error; err != nil {
		t.Fatal(err)
	}
	post(booking, 400) // taken
	off := booking
	off.StartsAt, off.Phone = day+"T09:10", "50371111111"
	post(off, 400) // not on the 15-minute grid
	late := booking
	late.StartsAt, late.Phone = day+"T11:30", "50371111111"
	post(late, 400) // would end after closing
	second := booking
	second.StartsAt, second.Phone = day+"T10:00", "7000 0000"
	post(second, 201)
	third := booking
	third.StartsAt = day + "T11:00"
	post(third, 400) // per-phone limit, also when written without the country code
	unknown := booking
	unknown.Service, unknown.Phone = "nada", "50372222222"
	post(unknown, 404)

	if got := slots(day); len(got) != 1 || got[0] != "11:00" {
		t.Fatalf("slots after bookings: %v", got)
	}
}
