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
	if _, err := validatedHours([]dayHours{{Open: "09:00", Close: "18:00"}}); err == nil {
		t.Fatal("expected error for incomplete week")
	}
	week := make([]dayHours, 7)
	if h, err := validatedHours(week); err != nil || len(h) != 0 {
		t.Fatalf("closed week should disable booking: %v %v", h, err)
	}
	week[1] = dayHours{Open: "18:00", Close: "09:00"}
	if _, err := validatedHours(week); err == nil {
		t.Fatal("expected error for inverted hours")
	}
	week[1] = dayHours{Open: " 09:00", Close: "18:00 "}
	if h, err := validatedHours(week); err != nil || h[1].Open != "09:00" {
		t.Fatalf("valid week: %v %v", h, err)
	}
	// Split shift blocks
	week[2] = dayHours{Blocks: []timeBlock{{Open: "14:00", Close: "18:00"}, {Open: "09:00", Close: "12:00"}}}
	h, err := validatedHours(week)
	if err != nil || len(h[2].Blocks) != 2 || h[2].Blocks[0].Open != "09:00" || h[2].Open != "09:00" || h[2].Close != "18:00" {
		t.Fatalf("split shift normalization failed: %+v %v", h, err)
	}
	// Overlapping split blocks rejected
	week[2] = dayHours{Blocks: []timeBlock{{Open: "09:00", Close: "13:00"}, {Open: "12:30", Close: "18:00"}}}
	if _, err := validatedHours(week); err == nil {
		t.Fatal("expected error for overlapping blocks")
	}
}

func TestOpenSlotsSplitShiftAndBuffer(t *testing.T) {
	loc := shopZone
	day := time.Date(2027, 6, 14, 0, 0, 0, 0, loc) // Monday
	now := day.Add(-24 * time.Hour)
	hours := make([]dayHours, 7)
	hours[time.Monday] = dayHours{
		Open: "09:00", Close: "15:00",
		Blocks: []timeBlock{{Open: "09:00", Close: "11:00"}, {Open: "13:00", Close: "15:00"}},
	}
	taken := []reservation{
		{StartsAt: time.Date(2027, 6, 14, 9, 30, 0, 0, loc), EndsAt: time.Date(2027, 6, 14, 10, 0, 0, 0, loc)},
	}
	// 30-min service, 15-min buffer:
	// Block 1 (09:00-11:00): 09:00 ends 09:30 (+15m buffer -> 09:45 overlaps 09:30), so 09:00 blocked.
	// 10:15 starts after 10:00+15m, ends 10:45 -> free. 10:30 ends 11:00 -> free.
	// Lunch gap 11:00-13:00 -> no slots.
	// Block 2 (13:00-15:00): 13:00..14:30 (7 slots).
	slots := openSlotsForSchedule(taken, hours, 15*time.Minute, time.Hour, 30*time.Minute, day, loc, now)
	got := make([]string, len(slots))
	for i, s := range slots {
		got[i] = s.Format("15:04")
	}
	want := []string{"10:15", "10:30", "13:00", "13:15", "13:30", "13:45", "14:00", "14:15", "14:30"}
	if strings.Join(got, ",") != strings.Join(want, ",") {
		t.Fatalf("got %v, want %v", got, want)
	}
}

func TestValidatedBookingConfigAndStaff(t *testing.T) {
	if _, err := validatedBookingConfig(bookingConfig{BufferMinutes: 150}); err == nil {
		t.Fatal("expected error for buffer > 120")
	}
	if _, err := validatedBookingConfig(bookingConfig{LeadTimeMinutes: 5}); err == nil {
		t.Fatal("expected error for lead time < 15")
	}
	cfg, err := validatedBookingConfig(bookingConfig{BufferMinutes: 15, LeadTimeMinutes: 120, HorizonDays: 30, CancelNoticeHours: 4, ReminderHoursBefore: 24, Reminder2HoursBefore: 24})
	if err != nil || cfg.Reminder2HoursBefore != 0 {
		t.Fatalf("unexpected bookingConfig: %+v %v", cfg, err)
	}
	staff, err := validatedStaff([]staffMember{
		{ID: "ana", Name: "Ana López", Role: "Estilista", Active: true, ServiceSlugs: []string{"corte", "corte"}},
	})
	if err != nil || len(staff) != 1 || len(staff[0].ServiceSlugs) != 1 {
		t.Fatalf("unexpected staff: %+v %v", staff, err)
	}
	if _, err := validatedStaff([]staffMember{{ID: "ana", Name: "A"}, {ID: "ana", Name: "B"}}); err == nil {
		t.Fatal("expected error for duplicate staff IDs")
	}
}

func TestReminderAndCustomerEmails(t *testing.T) {
	loc := shopZone
	start := time.Date(2027, 6, 15, 10, 0, 0, 0, loc)
	tok := "0123456789abcdef0123456789abcdef"
	b := reservation{ShopSlug: "luna", ServiceSlug: "gel", StaffID: "ana", Customer: "Sofía", Phone: "50370000000", Email: "sofia@example.com", ManageToken: &tok, StartsAt: start, EndsAt: start.Add(45 * time.Minute)}
	s := shop{Slug: "luna", Name: "Luna Uñas", Timezone: "America/El_Salvador", Locale: "es", Address: "Col. Escalón", Staff: []staffMember{{ID: "ana", Name: "Ana", Active: true}}}
	svc := product{Slug: "gel", Name: "Manicura en gel"}
	url := "https://vitrina.example/cita/" + tok

	sub, body := customerBookingEmailContent(b, svc, s, url, "es", "created")
	if !strings.Contains(sub, "Cita confirmada") || !strings.Contains(body, url) || !strings.Contains(body, "Especialista: Ana") {
		t.Fatalf("unexpected customer email: %q / %q", sub, body)
	}
	rSub, rBody := reminderEmailContent(b, svc, s, url, "es")
	if !strings.Contains(rSub, "Recordatorio") || !strings.Contains(rBody, "Col. Escalón") || !strings.Contains(rBody, url) {
		t.Fatalf("unexpected reminder email: %q / %q", rSub, rBody)
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
		hours[i] = dayHours{Open: "09:00", Close: "12:00"}
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

func TestBookingEmailContentUsesShopTimezone(t *testing.T) {
	ny, err := time.LoadLocation("America/New_York")
	if err != nil {
		t.Fatal(err)
	}
	start := time.Date(2027, 6, 15, 14, 30, 0, 0, ny) // 14:30 EDT = 12:30 El Salvador
	b := reservation{
		ShopSlug: "ny-studio",
		Customer: "Alex",
		Phone:    "15550100000",
		StartsAt: start,
		EndsAt:   start.Add(45 * time.Minute),
	}
	svc := product{Name: "Haircut"}
	s := shop{Slug: "ny-studio", Timezone: "America/New_York", Locale: "en"}

	subject, body := bookingEmailContent(b, svc, s, "https://vitrina.example/panel", "es")
	if !strings.Contains(subject, "15/06/2027 14:30") {
		t.Fatalf("expected NY local time in subject, got %q", subject)
	}
	if !strings.Contains(body, "Date: 15/06/2027 14:30 (America/New_York)") {
		t.Fatalf("expected NY timezone in body, got %q", body)
	}

	s.Locale = "es"
	subjectEs, bodyEs := bookingEmailContent(b, svc, s, "https://vitrina.example/panel", "en")
	if !strings.Contains(subjectEs, "Nueva cita: Haircut · 15/06/2027 14:30") {
		t.Fatalf("expected Spanish subject with NY time, got %q", subjectEs)
	}
	if !strings.Contains(bodyEs, "Fecha: 15/06/2027 14:30 (America/New_York)") {
		t.Fatalf("expected Spanish body with NY timezone, got %q", bodyEs)
	}
}

func TestAgendaV2MultiStaffSelfServiceAndReminders(t *testing.T) {
	db := testDB(t)
	slug := "agv2-" + strings.ReplaceAll(time.Now().UTC().Format("20060102150405.000000000"), ".", "")
	hours := make([]dayHours, 7)
	for i := range hours {
		hours[i] = dayHours{
			Open: "09:00", Close: "15:00",
			Blocks: []timeBlock{{Open: "09:00", Close: "12:00"}, {Open: "13:00", Close: "15:00"}},
		}
	}
	s := shop{
		Slug:  slug,
		Name:  "Estudio V2",
		Theme: "arena",
		Hours: hours,
		BookingConfig: bookingConfig{
			BufferMinutes:        15,
			LeadTimeMinutes:      60,
			HorizonDays:          30,
			CancelNoticeHours:    2,
			ReminderHoursBefore:  24,
			Reminder2HoursBefore: 2,
		},
		Staff: []staffMember{
			{ID: "ana", Name: "Ana", Active: true},
			{ID: "luis", Name: "Luis", Active: true},
		},
	}
	if err := db.Create(&s).Error; err != nil {
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

	tomorrow := time.Now().In(shopZone).AddDate(0, 0, 2).Format(localDate)
	book := func(input publicBookingInput) publicBookingResult {
		t.Helper()
		body, _ := json.Marshal(input)
		r := httptest.NewRequest(http.MethodPost, "/api/shops/"+slug+"/bookings", bytes.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		if w.Code != http.StatusCreated {
			t.Fatalf("book %+v: got %d %s", input, w.Code, w.Body.String())
		}
		var res publicBookingResult
		if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
			t.Fatal(err)
		}
		return res
	}

	// Book two customers at the exact same time with "any available" -> should assign Ana and Luis!
	first := book(publicBookingInput{Service: "corte", StartsAt: tomorrow + "T09:00", Customer: "Cliente 1", Phone: "+503 7000-0001", Email: "c1@example.com"})
	second := book(publicBookingInput{Service: "corte", StartsAt: tomorrow + "T09:00", Customer: "Cliente 2", Phone: "+503 7000-0002", Email: "c2@example.com"})
	if first.ManageToken == "" || second.ManageToken == "" {
		t.Fatalf("expected manage tokens: %+v %+v", first, second)
	}
	if first.StaffName == "" || second.StaffName == "" || first.StaffName == second.StaffName {
		t.Fatalf("expected distinct specialists assigned, got %q and %q", first.StaffName, second.StaffName)
	}

	// GET /api/bookings/{token}
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/bookings/"+first.ManageToken, nil))
	if w.Code != http.StatusOK {
		t.Fatalf("get booking by token: %d %s", w.Code, w.Body.String())
	}
	var detail publicBookingDetail
	if err := json.Unmarshal(w.Body.Bytes(), &detail); err != nil {
		t.Fatal(err)
	}
	if !detail.CanCancel || !detail.CanReschedule || detail.CancelNoticeHours != 2 {
		t.Fatalf("unexpected booking detail: %+v", detail)
	}

	// Reschedule into afternoon block (13:00)
	reschedBody, _ := json.Marshal(map[string]string{"startsAt": tomorrow + "T13:00", "staffId": "ana"})
	r := httptest.NewRequest(http.MethodPost, "/api/bookings/"+first.ManageToken+"/reschedule", bytes.NewReader(reschedBody))
	r.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("reschedule failed: %d %s", w.Code, w.Body.String())
	}
	if err := json.Unmarshal(w.Body.Bytes(), &detail); err != nil {
		t.Fatal(err)
	}
	if detail.StartsAt != tomorrow+"T13:00" || detail.StaffName != "Ana" {
		t.Fatalf("unexpected rescheduled detail: %+v", detail)
	}

	// Test automatic reminders with fakeResend
	sentTo := make(chan string, 10)
	delivery := fakeResend(t, make(chan string, 10), func(_ *http.Request, to []string) {
		for _, addr := range to {
			sentTo <- addr
		}
	})
	start, _ := time.ParseInLocation(localMinute, tomorrow+"T13:00", shopZone)
	sent, err := processBookingReminders(t.Context(), db, delivery, start.Add(-12*time.Hour))
	if err != nil || sent != 2 { // c1 (12h before 13:00) and c2 (8h before 09:00) both within 24h reminder window
		t.Fatalf("expected 2 first reminders, got %d err=%v", sent, err)
	}
	// Running again at same time should send 0 (idempotent)
	sentAgain, err := processBookingReminders(t.Context(), db, delivery, start.Add(-12*time.Hour))
	if err != nil || sentAgain != 0 {
		t.Fatalf("expected 0 duplicate reminders, got %d err=%v", sentAgain, err)
	}
	// Running 1h before c1 should send 2nd reminder for c1
	sent2, err := processBookingReminders(t.Context(), db, delivery, start.Add(-1*time.Hour))
	if err != nil || sent2 != 1 {
		t.Fatalf("expected 1 second reminder, got %d err=%v", sent2, err)
	}

	// Cancel via self-service token
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/bookings/"+first.ManageToken+"/cancel", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("cancel failed: %d %s", w.Code, w.Body.String())
	}
	if err := json.Unmarshal(w.Body.Bytes(), &detail); err != nil {
		t.Fatal(err)
	}
	if !detail.Cancelled || detail.CanCancel {
		t.Fatalf("expected cancelled booking: %+v", detail)
	}
}
