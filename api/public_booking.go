package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/mail"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	slotStep            = 15 * time.Minute
	bookingLeadTime     = time.Hour
	bookingHorizonDays  = 60
	maxActivePerPhone   = 2
	maxWebBookingsHour  = 30
	maxBlocksPerDay     = 4
	localDate           = "2006-01-02"
	publicBookingSource = "web"
)

var (
	clockPattern = regexp.MustCompile(`^([01][0-9]|2[0-3]):[0-5][0-9]$`)
	tokenPattern = regexp.MustCompile(`^[a-f0-9]{16,64}$`)
	errSlotTaken = validationError("Ese horario ya no está disponible. Elegí otro.")
)

func newManageToken() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b[:])
}

func errOutsideHorizonFor(days int) error {
	return validationError(fmt.Sprintf("Elegí una fecha dentro de los próximos %d días", days))
}

// validatedHours normalizes a weekly schedule: either empty (online booking off) or seven days.
// Each open day supports up to 4 non-overlapping time blocks (split shifts) or legacy open/close.
func validatedHours(hours []dayHours) ([]dayHours, error) {
	if len(hours) == 0 {
		return []dayHours{}, nil
	}
	if len(hours) != 7 {
		return nil, validationError("Indicá el horario de los siete días")
	}
	open := false
	result := make([]dayHours, 7)
	for i, day := range hours {
		rawBlocks := day.Blocks
		if len(rawBlocks) == 0 {
			o, c := strings.TrimSpace(day.Open), strings.TrimSpace(day.Close)
			if o == "" && c == "" {
				continue
			}
			rawBlocks = []timeBlock{{Open: o, Close: c}}
		}
		if len(rawBlocks) > maxBlocksPerDay {
			return nil, validationError("Podés definir hasta 4 bloques horarios por día")
		}
		clean := make([]timeBlock, 0, len(rawBlocks))
		for _, b := range rawBlocks {
			b.Open, b.Close = strings.TrimSpace(b.Open), strings.TrimSpace(b.Close)
			if b.Open == "" && b.Close == "" {
				continue
			}
			if !clockPattern.MatchString(b.Open) || !clockPattern.MatchString(b.Close) || b.Open >= b.Close {
				return nil, validationError("Cada día abierto necesita una hora de apertura anterior a la de cierre")
			}
			clean = append(clean, b)
		}
		if len(clean) == 0 {
			continue
		}
		slices.SortFunc(clean, func(a, b timeBlock) int {
			return strings.Compare(a.Open, b.Open)
		})
		for j := 1; j < len(clean); j++ {
			if clean[j].Open < clean[j-1].Close {
				return nil, validationError("Los bloques horarios de un mismo día no pueden superponerse")
			}
		}
		entry := dayHours{
			Open:  clean[0].Open,
			Close: clean[len(clean)-1].Close,
		}
		if len(clean) > 1 {
			entry.Blocks = clean
		}
		result[i], open = entry, true
	}
	if !open {
		return []dayHours{}, nil
	}
	return result, nil
}

func openSlotsForSchedule(taken []reservation, hours []dayHours, buffer, leadTime, duration time.Duration, date time.Time, loc *time.Location, now time.Time) []time.Time {
	if len(hours) != 7 {
		return nil
	}
	blocks := hours[date.Weekday()].intervals()
	if len(blocks) == 0 {
		return nil
	}
	dateStr := date.Format(localDate)
	at := func(clock string) time.Time {
		t, _ := time.ParseInLocation(localMinute, dateStr+"T"+clock, loc)
		return t
	}
	earliest := now.Add(leadTime)
	var slots []time.Time
	for _, b := range blocks {
		opens, closes := at(b.Open), at(b.Close)
		for start := opens; !start.Add(duration).After(closes); start = start.Add(slotStep) {
			if start.Before(earliest) {
				continue
			}
			end := start.Add(duration)
			free := true
			for _, r := range taken {
				if r.StartsAt.Before(end.Add(buffer)) && r.EndsAt.Add(buffer).After(start) {
					free = false
					break
				}
			}
			if free {
				slots = append(slots, start)
			}
		}
	}
	return slots
}

func dayBounds(hours []dayHours, date time.Time, loc *time.Location) (time.Time, time.Time, bool) {
	if len(hours) != 7 {
		return time.Time{}, time.Time{}, false
	}
	blocks := hours[date.Weekday()].intervals()
	if len(blocks) == 0 {
		return time.Time{}, time.Time{}, false
	}
	dateStr := date.Format(localDate)
	first, _ := time.ParseInLocation(localMinute, dateStr+"T"+blocks[0].Open, loc)
	last, _ := time.ParseInLocation(localMinute, dateStr+"T"+blocks[len(blocks)-1].Close, loc)
	return first, last, true
}

func staffHours(s shop, m staffMember) []dayHours {
	if len(m.Hours) == 7 {
		return m.Hours
	}
	return s.Hours
}

// openSlots lists the free start times for a service on a date, in the shop's time zone.
// If staffID is empty and the shop has active specialists for the service, returns the union of free slots across all eligible specialists.
func openSlots(db *gorm.DB, s shop, service product, date time.Time, now time.Time, staffID string, excludeBookingID uint) ([]time.Time, error) {
	if len(s.Hours) != 7 {
		return nil, nil
	}
	dateStr := date.Format(localDate)
	if slices.Contains(s.BlockedDates, dateStr) {
		return nil, nil
	}
	loc := s.location()
	buf := s.bookingBuffer()
	lead := s.bookingLeadTime()
	duration := time.Duration(service.DurationMinutes) * time.Minute
	eligible := s.activeStaffForService(service.Slug)

	// Single-agenda mode (no active specialists configured for this service).
	if len(eligible) == 0 {
		if staffID != "" {
			return nil, validationError("Elegí un especialista disponible")
		}
		opens, closes, ok := dayBounds(s.Hours, date, loc)
		if !ok {
			return nil, nil
		}
		var taken []reservation
		q := db.Select("starts_at", "ends_at").
			Where("shop_slug = ? AND cancelled_at IS NULL", s.Slug).
			Where(clause.Lt{Column: "starts_at", Value: closes.Add(buf)}, clause.Gt{Column: "ends_at", Value: opens.Add(-buf)})
		if excludeBookingID != 0 {
			q = q.Where("id <> ?", excludeBookingID)
		}
		if err := q.Order("starts_at").Find(&taken).Error; err != nil {
			return nil, err
		}
		return openSlotsForSchedule(taken, s.Hours, buf, lead, duration, date, loc, now), nil
	}

	// Specific specialist requested.
	if staffID != "" {
		var member staffMember
		found := false
		for _, m := range eligible {
			if m.ID == staffID {
				member, found = m, true
				break
			}
		}
		if !found {
			return nil, validationError("Elegí un especialista disponible")
		}
		hrs := staffHours(s, member)
		opens, closes, ok := dayBounds(hrs, date, loc)
		if !ok {
			return nil, nil
		}
		var taken []reservation
		q := db.Select("starts_at", "ends_at").
			Where("shop_slug = ? AND staff_id = ? AND cancelled_at IS NULL", s.Slug, member.ID).
			Where(clause.Lt{Column: "starts_at", Value: closes.Add(buf)}, clause.Gt{Column: "ends_at", Value: opens.Add(-buf)})
		if excludeBookingID != 0 {
			q = q.Where("id <> ?", excludeBookingID)
		}
		if err := q.Order("starts_at").Find(&taken).Error; err != nil {
			return nil, err
		}
		return openSlotsForSchedule(taken, hrs, buf, lead, duration, date, loc, now), nil
	}

	// Any available specialist: compute union across eligible staff.
	var minOpen, maxClose time.Time
	for _, m := range eligible {
		o, c, ok := dayBounds(staffHours(s, m), date, loc)
		if !ok {
			continue
		}
		if minOpen.IsZero() || o.Before(minOpen) {
			minOpen = o
		}
		if maxClose.IsZero() || c.After(maxClose) {
			maxClose = c
		}
	}
	if minOpen.IsZero() {
		return nil, nil
	}
	var allTaken []reservation
	q := db.Select("staff_id", "starts_at", "ends_at").
		Where("shop_slug = ? AND cancelled_at IS NULL", s.Slug).
		Where(clause.Lt{Column: "starts_at", Value: maxClose.Add(buf)}, clause.Gt{Column: "ends_at", Value: minOpen.Add(-buf)})
	if excludeBookingID != 0 {
		q = q.Where("id <> ?", excludeBookingID)
	}
	if err := q.Order("starts_at").Find(&allTaken).Error; err != nil {
		return nil, err
	}
	byStaff := make(map[string][]reservation, len(eligible))
	for _, r := range allTaken {
		byStaff[r.StaffID] = append(byStaff[r.StaffID], r)
	}
	seen := make(map[int64]bool)
	var union []time.Time
	for _, m := range eligible {
		for _, slot := range openSlotsForSchedule(byStaff[m.ID], staffHours(s, m), buf, lead, duration, date, loc, now) {
			k := slot.Unix()
			if !seen[k] {
				seen[k] = true
				union = append(union, slot)
			}
		}
	}
	slices.SortFunc(union, func(a, b time.Time) int {
		return a.Compare(b)
	})
	return union, nil
}

// pickAvailableStaff verifies `start` is free and returns the assigned staffMember (empty if shop has no staff).
func pickAvailableStaff(tx *gorm.DB, s shop, service product, start time.Time, preferredStaffID string, excludeBookingID uint, now time.Time) (staffMember, bool, error) {
	eligible := s.activeStaffForService(service.Slug)
	if len(eligible) == 0 {
		if preferredStaffID != "" {
			return staffMember{}, false, validationError("Elegí un especialista disponible")
		}
		slots, err := openSlots(tx, s, service, start, now, "", excludeBookingID)
		if err != nil {
			return staffMember{}, false, err
		}
		for _, slot := range slots {
			if slot.Equal(start) {
				return staffMember{}, true, nil
			}
		}
		return staffMember{}, false, nil
	}
	if preferredStaffID != "" {
		slots, err := openSlots(tx, s, service, start, now, preferredStaffID, excludeBookingID)
		if err != nil {
			return staffMember{}, false, err
		}
		for _, slot := range slots {
			if slot.Equal(start) {
				m, _ := s.findStaff(preferredStaffID)
				return m, true, nil
			}
		}
		return staffMember{}, false, nil
	}
	// Auto-assign: pick the available specialist with fewest bookings that day.
	loc := s.location()
	dayStart, _ := time.ParseInLocation(localDate, start.In(loc).Format(localDate), loc)
	dayEnd := dayStart.AddDate(0, 0, 1)
	var dayRows []reservation
	q := tx.Select("staff_id").Where("shop_slug = ? AND cancelled_at IS NULL AND starts_at >= ? AND starts_at < ?", s.Slug, dayStart, dayEnd)
	if excludeBookingID != 0 {
		q = q.Where("id <> ?", excludeBookingID)
	}
	_ = q.Find(&dayRows).Error
	counts := make(map[string]int, len(eligible))
	for _, row := range dayRows {
		counts[row.StaffID]++
	}
	var chosen staffMember
	found := false
	bestCount := -1
	for _, m := range eligible {
		slots, err := openSlots(tx, s, service, start, now, m.ID, excludeBookingID)
		if err != nil {
			return staffMember{}, false, err
		}
		ok := false
		for _, slot := range slots {
			if slot.Equal(start) {
				ok = true
				break
			}
		}
		if ok && (!found || counts[m.ID] < bestCount) {
			chosen, found, bestCount = m, true, counts[m.ID]
		}
	}
	return chosen, found, nil
}

// bookableDate parses a shop-local date inside the booking horizon.
func bookableDate(input string, now time.Time, loc *time.Location, horizonDays int) (time.Time, error) {
	if loc == nil {
		loc = shopZone
	}
	if horizonDays <= 0 {
		horizonDays = bookingHorizonDays
	}
	date, err := time.ParseInLocation(localDate, input, loc)
	if err != nil {
		return date, errOutsideHorizonFor(horizonDays)
	}
	today, _ := time.ParseInLocation(localDate, now.In(loc).Format(localDate), loc)
	if date.Before(today) || date.After(today.AddDate(0, 0, horizonDays)) {
		return date, errOutsideHorizonFor(horizonDays)
	}
	return date, nil
}

func publicService(db *gorm.DB, shopSlug, serviceSlug string) (shop, product, error) {
	var s shop
	if !validSlug(shopSlug) || !validSlug(serviceSlug) {
		return s, product{}, gorm.ErrRecordNotFound
	}
	if err := db.Take(&s, "slug = ?", shopSlug).Error; err != nil {
		return s, product{}, err
	}
	p, err := bookableService(db, shopSlug, serviceSlug)
	return s, p, err
}

func cleanOptionalEmail(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", nil
	}
	if len(trimmed) > 200 {
		return "", validationError("Indicá un correo electrónico válido")
	}
	addr, err := mail.ParseAddress(trimmed)
	if err != nil || addr.Address != trimmed || !strings.Contains(addr.Address, "@") {
		return "", validationError("Indicá un correo electrónico válido")
	}
	return strings.ToLower(addr.Address), nil
}

type publicBookingInput struct {
	Service  string `json:"service"`
	StaffID  string `json:"staffId"`
	StartsAt string `json:"startsAt"`
	Customer string `json:"customer"`
	Phone    string `json:"phone"`
	Email    string `json:"email"`
	Notes    string `json:"notes"`
}

type publicBookingResult struct {
	Service     string `json:"service"`
	StartsAt    string `json:"startsAt"`
	EndsAt      string `json:"endsAt"`
	StaffName   string `json:"staffName,omitempty"`
	ManageToken string `json:"manageToken"`
}

type publicBookingDetail struct {
	Token             string        `json:"token"`
	ShopSlug          string        `json:"shopSlug"`
	ShopName          string        `json:"shopName"`
	ShopTheme         string        `json:"shopTheme"`
	ShopTimezone      string        `json:"shopTimezone"`
	ShopLocale        string        `json:"shopLocale"`
	ShopWhatsapp      string        `json:"shopWhatsapp"`
	ServiceSlug       string        `json:"serviceSlug"`
	ServiceName       string        `json:"serviceName"`
	DurationMinutes   int           `json:"durationMinutes"`
	StaffID           string        `json:"staffId,omitempty"`
	StaffName         string        `json:"staffName,omitempty"`
	EligibleStaff     []staffMember `json:"eligibleStaff"`
	Customer          string        `json:"customer"`
	Phone             string        `json:"phone"`
	Email             string        `json:"email,omitempty"`
	Notes             string        `json:"notes,omitempty"`
	StartsAt          string        `json:"startsAt"`
	EndsAt            string        `json:"endsAt"`
	Cancelled         bool          `json:"cancelled"`
	CanCancel         bool          `json:"canCancel"`
	CanReschedule     bool          `json:"canReschedule"`
	CancelNoticeHours int           `json:"cancelNoticeHours"`
	HorizonDays       int           `json:"horizonDays"`
}

func bookPublic(db *gorm.DB, shopSlug string, input publicBookingInput, now time.Time) (reservation, product, shop, error) {
	var r reservation
	var service product
	var s shop
	customer, err := cleanCustomer(input.Customer)
	if err != nil {
		return r, service, s, err
	}
	phone, ok := normalizePhone(input.Phone)
	if !ok {
		return r, service, s, validationError("Indicá un teléfono válido, con código de país")
	}
	email, err := cleanOptionalEmail(input.Email)
	if err != nil {
		return r, service, s, err
	}
	notes := strings.TrimSpace(input.Notes)
	if utf8.RuneCountInString(notes) > 300 {
		return r, service, s, validationError("Las notas pueden tener hasta 300 caracteres")
	}
	err = withShopAgenda(db, shopSlug, func(tx *gorm.DB) error {
		s, service, err = publicService(tx, shopSlug, input.Service)
		if err != nil {
			return err
		}
		loc := s.location()
		start, err := time.ParseInLocation(localMinute, input.StartsAt, loc)
		if err != nil {
			return validationError("Elegí un horario válido")
		}
		if _, err := bookableDate(start.Format(localDate), now, loc, s.bookingHorizonDays()); err != nil {
			return err
		}
		var recent, active int64
		if err := tx.Model(&reservation{}).Where("shop_slug = ? AND source = ? AND created_at > ?", shopSlug, publicBookingSource, now.Add(-time.Hour)).Count(&recent).Error; err != nil {
			return err
		}
		if recent >= maxWebBookingsHour {
			return validationError("La agenda recibió muchas reservas. Intentá de nuevo más tarde o escribí al negocio.")
		}
		// Older bookings stored local numbers without El Salvador's country code.
		phones := []string{phone}
		if len(phone) == 11 && strings.HasPrefix(phone, "503") {
			phones = append(phones, phone[3:])
		}
		if err := tx.Model(&reservation{}).Where("shop_slug = ? AND phone IN ? AND cancelled_at IS NULL AND starts_at > ?", shopSlug, phones, now).Count(&active).Error; err != nil {
			return err
		}
		if active >= maxActivePerPhone {
			return validationError("Ya tenés citas pendientes en este negocio. Escribiles para cambiarlas.")
		}
		assigned, available, err := pickAvailableStaff(tx, s, service, start, strings.TrimSpace(input.StaffID), 0, now)
		if err != nil {
			return err
		}
		if !available {
			return errSlotTaken
		}
		token := newManageToken()
		r = reservation{
			ShopSlug: shopSlug, ServiceSlug: service.Slug, StaffID: assigned.ID,
			Customer: customer, Phone: phone, Email: email, Notes: notes,
			Source: publicBookingSource, ManageToken: &token,
			StartsAt: start, EndsAt: start.Add(time.Duration(service.DurationMinutes) * time.Minute),
		}
		return tx.Create(&r).Error
	})
	return r, service, s, err
}

func loadPublicBookingByToken(db *gorm.DB, token string, now time.Time) (publicBookingDetail, error) {
	var detail publicBookingDetail
	if !tokenPattern.MatchString(token) {
		return detail, gorm.ErrRecordNotFound
	}
	var r reservation
	if err := db.Take(&r, "manage_token = ?", token).Error; err != nil {
		return detail, err
	}
	var s shop
	if err := db.Take(&s, "slug = ?", r.ShopSlug).Error; err != nil {
		return detail, err
	}
	var service product
	_ = db.Take(&service, "shop_slug = ? AND slug = ?", r.ShopSlug, r.ServiceSlug).Error
	loc := s.location()
	canModify := r.CancelledAt == nil && r.StartsAt.After(now.Add(s.cancelNotice()))
	eligible := s.activeStaffForService(r.ServiceSlug)
	if eligible == nil {
		eligible = []staffMember{}
	}
	svcName := service.Name
	if svcName == "" {
		svcName = r.ServiceSlug
	}
	dur := service.DurationMinutes
	if dur <= 0 {
		dur = int(r.EndsAt.Sub(r.StartsAt).Minutes())
	}
	return publicBookingDetail{
		Token:             token,
		ShopSlug:          s.Slug,
		ShopName:          s.Name,
		ShopTheme:         s.Theme,
		ShopTimezone:      s.Timezone,
		ShopLocale:        s.Locale,
		ShopWhatsapp:      s.Whatsapp,
		ServiceSlug:       r.ServiceSlug,
		ServiceName:       svcName,
		DurationMinutes:   dur,
		StaffID:           r.StaffID,
		StaffName:         s.staffName(r.StaffID),
		EligibleStaff:     eligible,
		Customer:          r.Customer,
		Phone:             r.Phone,
		Email:             r.Email,
		Notes:             r.Notes,
		StartsAt:          r.StartsAt.In(loc).Format(localMinute),
		EndsAt:            r.EndsAt.In(loc).Format(localMinute),
		Cancelled:         r.CancelledAt != nil,
		CanCancel:         canModify,
		CanReschedule:     canModify && service.Slug != "" && service.Available && !service.Hidden,
		CancelNoticeHours: s.BookingConfig.CancelNoticeHours,
		HorizonDays:       s.bookingHorizonDays(),
	}, nil
}

func cancelPublicBooking(db *gorm.DB, token string, now time.Time) (reservation, product, shop, error) {
	var r reservation
	var service product
	var s shop
	if !tokenPattern.MatchString(token) {
		return r, service, s, gorm.ErrRecordNotFound
	}
	if err := db.Take(&r, "manage_token = ?", token).Error; err != nil {
		return r, service, s, err
	}
	err := withShopAgenda(db, r.ShopSlug, func(tx *gorm.DB) error {
		if err := tx.Take(&r, "manage_token = ?", token).Error; err != nil {
			return err
		}
		if err := tx.Take(&s, "slug = ?", r.ShopSlug).Error; err != nil {
			return err
		}
		_ = tx.Take(&service, "shop_slug = ? AND slug = ?", r.ShopSlug, r.ServiceSlug).Error
		if r.CancelledAt != nil {
			return validationError("Esta cita ya fue cancelada")
		}
		if !r.StartsAt.After(now.Add(s.cancelNotice())) {
			if s.BookingConfig.CancelNoticeHours > 0 {
				return validationError(fmt.Sprintf("Solo podés cancelar con al menos %d horas de anticipación. Escribí al negocio.", s.BookingConfig.CancelNoticeHours))
			}
			return validationError("Solo podés cancelar citas futuras")
		}
		r.CancelledAt = &now
		return tx.Model(&r).Update("cancelled_at", now).Error
	})
	return r, service, s, err
}

func reschedulePublicBooking(db *gorm.DB, token, newStartsAt, preferredStaffID string, now time.Time) (reservation, product, shop, error) {
	var r reservation
	var service product
	var s shop
	if !tokenPattern.MatchString(token) {
		return r, service, s, gorm.ErrRecordNotFound
	}
	if err := db.Take(&r, "manage_token = ?", token).Error; err != nil {
		return r, service, s, err
	}
	err := withShopAgenda(db, r.ShopSlug, func(tx *gorm.DB) error {
		if err := tx.Take(&r, "manage_token = ?", token).Error; err != nil {
			return err
		}
		if err := tx.Take(&s, "slug = ?", r.ShopSlug).Error; err != nil {
			return err
		}
		if r.CancelledAt != nil {
			return validationError("Esta cita ya fue cancelada")
		}
		if !r.StartsAt.After(now.Add(s.cancelNotice())) {
			if s.BookingConfig.CancelNoticeHours > 0 {
				return validationError(fmt.Sprintf("Solo podés reprogramar con al menos %d horas de anticipación. Escribí al negocio.", s.BookingConfig.CancelNoticeHours))
			}
			return validationError("Solo podés reprogramar citas futuras")
		}
		var err error
		service, err = bookableService(tx, r.ShopSlug, r.ServiceSlug)
		if err != nil {
			return err
		}
		loc := s.location()
		start, err := time.ParseInLocation(localMinute, newStartsAt, loc)
		if err != nil {
			return validationError("Elegí un horario válido")
		}
		if _, err := bookableDate(start.Format(localDate), now, loc, s.bookingHorizonDays()); err != nil {
			return err
		}
		assigned, available, err := pickAvailableStaff(tx, s, service, start, strings.TrimSpace(preferredStaffID), r.ID, now)
		if err != nil {
			return err
		}
		if !available {
			return errSlotTaken
		}
		r.StartsAt = start
		r.EndsAt = start.Add(time.Duration(service.DurationMinutes) * time.Minute)
		r.StaffID = assigned.ID
		r.Reminder1SentAt = nil
		r.Reminder2SentAt = nil
		return tx.Model(&r).Select("starts_at", "ends_at", "staff_id", "reminder1_sent_at", "reminder2_sent_at").Updates(&r).Error
	})
	return r, service, s, err
}

func publicBookingRoutes(mux *http.ServeMux, db *gorm.DB, delivery *resendDelivery) {
	mux.HandleFunc("GET /api/shops/{slug}/slots", func(w http.ResponseWriter, r *http.Request) {
		q := db.WithContext(r.Context())
		s, service, err := publicService(q, r.PathValue("slug"), r.URL.Query().Get("service"))
		if err != nil {
			writeError(w, err)
			return
		}
		now := time.Now()
		date, err := bookableDate(r.URL.Query().Get("date"), now, s.location(), s.bookingHorizonDays())
		if err != nil {
			writeError(w, err)
			return
		}
		var excludeID uint
		if tok := strings.TrimSpace(r.URL.Query().Get("excludeToken")); tokenPattern.MatchString(tok) {
			var existing reservation
			if q.Select("id").Take(&existing, "manage_token = ? AND shop_slug = ?", tok, s.Slug).Error == nil {
				excludeID = existing.ID
			}
		}
		slots, err := openSlots(q, s, service, date, now, strings.TrimSpace(r.URL.Query().Get("staff")), excludeID)
		if err != nil {
			writeError(w, err)
			return
		}
		list := make([]string, 0, len(slots))
		for _, slot := range slots {
			list = append(list, slot.Format("15:04"))
		}
		writeJSON(w, http.StatusOK, map[string]any{"slots": list})
	})

	notify := make(chan struct{}, 8)
	sendAsync := func(label string, fn func(ctx context.Context) error) {
		if delivery == nil {
			return
		}
		select {
		case notify <- struct{}{}:
			go func() {
				defer func() { <-notify }()
				ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				defer cancel()
				if err := fn(ctx); err != nil {
					log.Printf("%s: %v", label, err)
				}
			}()
		default:
			log.Printf("%s omitido: demasiados envíos en curso", label)
		}
	}

	mux.HandleFunc("POST /api/shops/{slug}/bookings", func(w http.ResponseWriter, r *http.Request) {
		var input publicBookingInput
		if !readJSON(w, r, &input, 4096) {
			return
		}
		booking, service, bookedShop, err := bookPublic(db.WithContext(r.Context()), r.PathValue("slug"), input, time.Now())
		if err != nil {
			writeError(w, err)
			return
		}
		liveHub.publish(bookedShop.Slug, "bookings")
		locale := requestLocale(r)
		sendAsync(fmt.Sprintf("No se pudo avisar la reserva %d", booking.ID), func(ctx context.Context) error {
			if err := notifyNewBooking(ctx, db, delivery, booking, service, bookedShop, locale); err != nil {
				log.Printf("No se pudo avisar al negocio la reserva %d: %v", booking.ID, err)
			}
			if booking.Email != "" {
				return notifyCustomerBooking(ctx, delivery, booking, service, bookedShop, locale, "created")
			}
			return nil
		})
		loc := bookedShop.location()
		token := ""
		if booking.ManageToken != nil {
			token = *booking.ManageToken
		}
		writeJSON(w, http.StatusCreated, publicBookingResult{
			Service:     service.Name,
			StartsAt:    booking.StartsAt.In(loc).Format(localMinute),
			EndsAt:      booking.EndsAt.In(loc).Format(localMinute),
			StaffName:   bookedShop.staffName(booking.StaffID),
			ManageToken: token,
		})
	})

	mux.HandleFunc("GET /api/bookings/{token}", func(w http.ResponseWriter, r *http.Request) {
		detail, err := loadPublicBookingByToken(db.WithContext(r.Context()), r.PathValue("token"), time.Now())
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, detail)
	})

	mux.HandleFunc("POST /api/bookings/{token}/cancel", func(w http.ResponseWriter, r *http.Request) {
		booking, service, bookedShop, err := cancelPublicBooking(db.WithContext(r.Context()), r.PathValue("token"), time.Now())
		if err != nil {
			writeError(w, err)
			return
		}
		liveHub.publish(bookedShop.Slug, "bookings")
		locale := requestLocale(r)
		sendAsync(fmt.Sprintf("No se pudo avisar cancelación %d", booking.ID), func(ctx context.Context) error {
			_ = notifyBookingChange(ctx, db, delivery, booking, service, bookedShop, locale, "cancelled")
			if booking.Email != "" {
				return notifyCustomerBooking(ctx, delivery, booking, service, bookedShop, locale, "cancelled")
			}
			return nil
		})
		detail, err := loadPublicBookingByToken(db.WithContext(r.Context()), r.PathValue("token"), time.Now())
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, detail)
	})

	mux.HandleFunc("POST /api/bookings/{token}/reschedule", func(w http.ResponseWriter, r *http.Request) {
		var input struct {
			StartsAt string `json:"startsAt"`
			StaffID  string `json:"staffId"`
		}
		if !readJSON(w, r, &input, 1024) {
			return
		}
		booking, service, bookedShop, err := reschedulePublicBooking(db.WithContext(r.Context()), r.PathValue("token"), input.StartsAt, input.StaffID, time.Now())
		if err != nil {
			writeError(w, err)
			return
		}
		liveHub.publish(bookedShop.Slug, "bookings")
		locale := requestLocale(r)
		sendAsync(fmt.Sprintf("No se pudo avisar reprogramación %d", booking.ID), func(ctx context.Context) error {
			_ = notifyBookingChange(ctx, db, delivery, booking, service, bookedShop, locale, "rescheduled")
			if booking.Email != "" {
				return notifyCustomerBooking(ctx, delivery, booking, service, bookedShop, locale, "rescheduled")
			}
			return nil
		})
		detail, err := loadPublicBookingByToken(db.WithContext(r.Context()), r.PathValue("token"), time.Now())
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, detail)
	})
}

func resolveEmailLocale(s shop, fallback string) string {
	if s.Locale == "en" || s.Locale == "es" {
		return s.Locale
	}
	if fallback == "en" {
		return "en"
	}
	return "es"
}

func bookingEmailContent(booking reservation, service product, s shop, panelURL, locale string) (subject, text string) {
	locale = resolveEmailLocale(s, locale)
	loc := s.location()
	tz := s.Timezone
	if tz == "" {
		tz = "America/El_Salvador"
	}
	when := booking.StartsAt.In(loc).Format("02/01/2006 15:04")
	staffName := s.staffName(booking.StaffID)
	if locale == "en" {
		subject = "New booking: " + service.Name + " · " + when
		text = "New booking received from your online store.\n\n" +
			"Service: " + service.Name + "\n"
		if staffName != "" {
			text += "Specialist: " + staffName + "\n"
		}
		text += "Date: " + when + " (" + tz + ")\n" +
			"Customer: " + booking.Customer + "\n" +
			"Phone: +" + booking.Phone + "\n"
		if booking.Email != "" {
			text += "Email: " + booking.Email + "\n"
		}
		if booking.Notes != "" {
			text += "Notes: " + booking.Notes + "\n"
		}
		text += "\nReview or cancel it at " + panelURL
		return subject, text
	}
	subject = "Nueva cita: " + service.Name + " · " + when
	text = "Nueva cita reservada desde la tienda en línea.\n\n" +
		"Servicio: " + service.Name + "\n"
	if staffName != "" {
		text += "Especialista: " + staffName + "\n"
	}
	text += "Fecha: " + when + " (" + tz + ")\n" +
		"Cliente: " + booking.Customer + "\n" +
		"Teléfono: +" + booking.Phone + "\n"
	if booking.Email != "" {
		text += "Correo: " + booking.Email + "\n"
	}
	if booking.Notes != "" {
		text += "Notas: " + booking.Notes + "\n"
	}
	text += "\nRevisala o cancelala en " + panelURL
	return subject, text
}

func customerBookingEmailContent(booking reservation, service product, s shop, manageURL, locale, kind string) (subject, text string) {
	locale = resolveEmailLocale(s, locale)
	loc := s.location()
	tz := s.Timezone
	if tz == "" {
		tz = "America/El_Salvador"
	}
	when := booking.StartsAt.In(loc).Format("02/01/2006 15:04")
	staffName := s.staffName(booking.StaffID)
	svcName := service.Name
	if svcName == "" {
		svcName = booking.ServiceSlug
	}
	if locale == "en" {
		switch kind {
		case "cancelled":
			subject = "Booking cancelled: " + svcName + " · " + s.Name
			text = "Your appointment with " + s.Name + " has been cancelled.\n\n"
		case "rescheduled":
			subject = "Booking rescheduled: " + svcName + " · " + when
			text = "Your appointment with " + s.Name + " has been rescheduled.\n\n"
		default:
			subject = "Booking confirmed: " + svcName + " · " + when
			text = "Your appointment with " + s.Name + " is confirmed.\n\n"
		}
		text += "Service: " + svcName + "\n"
		if staffName != "" {
			text += "Specialist: " + staffName + "\n"
		}
		text += "Date: " + when + " (" + tz + ")\n"
		if manageURL != "" && kind != "cancelled" {
			text += "\nView, reschedule, or cancel your appointment:\n" + manageURL
		}
		return subject, text
	}
	switch kind {
	case "cancelled":
		subject = "Cita cancelada: " + svcName + " · " + s.Name
		text = "Tu cita en " + s.Name + " ha sido cancelada.\n\n"
	case "rescheduled":
		subject = "Cita reprogramada: " + svcName + " · " + when
		text = "Tu cita en " + s.Name + " ha sido reprogramada.\n\n"
	default:
		subject = "Cita confirmada: " + svcName + " · " + when
		text = "Tu cita en " + s.Name + " está confirmada.\n\n"
	}
	text += "Servicio: " + svcName + "\n"
	if staffName != "" {
		text += "Especialista: " + staffName + "\n"
	}
	text += "Fecha: " + when + " (" + tz + ")\n"
	if manageURL != "" && kind != "cancelled" {
		text += "\nConsultá, reprogramá o cancelá tu cita aquí:\n" + manageURL
	}
	return subject, text
}

func manageBookingURL(delivery *resendDelivery, booking reservation) string {
	if delivery == nil || booking.ManageToken == nil || *booking.ManageToken == "" {
		return ""
	}
	u := delivery.origin
	u.Path = "/cita/" + *booking.ManageToken
	return u.String()
}

func notifyNewBooking(ctx context.Context, db *gorm.DB, delivery *resendDelivery, booking reservation, service product, s shop, locale string) error {
	var emails []string
	if err := db.WithContext(ctx).Model(&shopMembership{}).Where("shop_slug = ?", booking.ShopSlug).Pluck("seller_email", &emails).Error; err != nil {
		return err
	}
	if len(emails) == 0 {
		return nil
	}
	panel := delivery.origin
	panel.Path = "/panel"
	subject, text := bookingEmailContent(booking, service, s, panel.String(), locale)
	return delivery.send(ctx, emails, subject, text, "vitrina-booking/"+booking.ShopSlug+"/"+strconv.FormatUint(uint64(booking.ID), 10))
}

func notifyCustomerBooking(ctx context.Context, delivery *resendDelivery, booking reservation, service product, s shop, locale, kind string) error {
	if booking.Email == "" {
		return nil
	}
	subject, text := customerBookingEmailContent(booking, service, s, manageBookingURL(delivery, booking), locale, kind)
	key := fmt.Sprintf("vitrina-customer-booking/%s/%d/%s/%d", booking.ShopSlug, booking.ID, kind, booking.StartsAt.Unix())
	return delivery.send(ctx, []string{booking.Email}, subject, text, key)
}

func notifyBookingChange(ctx context.Context, db *gorm.DB, delivery *resendDelivery, booking reservation, service product, s shop, locale, kind string) error {
	var emails []string
	if err := db.WithContext(ctx).Model(&shopMembership{}).Where("shop_slug = ?", booking.ShopSlug).Pluck("seller_email", &emails).Error; err != nil {
		return err
	}
	if len(emails) == 0 {
		return nil
	}
	locale = resolveEmailLocale(s, locale)
	loc := s.location()
	when := booking.StartsAt.In(loc).Format("02/01/2006 15:04")
	svcName := service.Name
	if svcName == "" {
		svcName = booking.ServiceSlug
	}
	panel := delivery.origin
	panel.Path = "/panel"
	var subject, text string
	if locale == "en" {
		if kind == "cancelled" {
			subject = "Booking cancelled by customer: " + svcName + " · " + when
			text = booking.Customer + " cancelled their appointment for " + svcName + " (" + when + ").\n\nView agenda: " + panel.String()
		} else {
			subject = "Booking rescheduled by customer: " + svcName + " · " + when
			text = booking.Customer + " rescheduled their appointment for " + svcName + " to " + when + ".\n\nView agenda: " + panel.String()
		}
	} else {
		if kind == "cancelled" {
			subject = "Cita cancelada por cliente: " + svcName + " · " + when
			text = booking.Customer + " canceló su cita de " + svcName + " (" + when + ").\n\nVer agenda: " + panel.String()
		} else {
			subject = "Cita reprogramada por cliente: " + svcName + " · " + when
			text = booking.Customer + " reprogramó su cita de " + svcName + " para el " + when + ".\n\nVer agenda: " + panel.String()
		}
	}
	key := fmt.Sprintf("vitrina-booking-change/%s/%d/%s/%d", booking.ShopSlug, booking.ID, kind, time.Now().Unix()/60)
	return delivery.send(ctx, emails, subject, text, key)
}

var _ = errors.Is
