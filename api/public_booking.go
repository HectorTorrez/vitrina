package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"regexp"
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
	publicDateLayout    = "2006-01-02"
	publicStartLayout   = "2006-01-02T15:04"
	publicBookingSource = "web"
)

var (
	clockPattern        = regexp.MustCompile(`^([01][0-9]|2[0-3]):[0-5][0-9]$`)
	customerPhoneDigits = regexp.MustCompile(`^[0-9]{8,15}$`)
	errSlotTaken        = panelValidation("Ese horario ya no está disponible. Elegí otro.")
)

// validatedHours normalizes a weekly schedule: either empty (online booking off) or seven days.
func validatedHours(hours []dayHours) ([]dayHours, error) {
	if len(hours) == 0 {
		return []dayHours{}, nil
	}
	if len(hours) != 7 {
		return nil, panelValidation("Indicá el horario de los siete días")
	}
	open := false
	result := make([]dayHours, 7)
	for i, day := range hours {
		day.Open, day.Close = strings.TrimSpace(day.Open), strings.TrimSpace(day.Close)
		if day.Open == "" && day.Close == "" {
			continue
		}
		if !clockPattern.MatchString(day.Open) || !clockPattern.MatchString(day.Close) || day.Open >= day.Close {
			return nil, panelValidation("Cada día abierto necesita una hora de apertura anterior a la de cierre")
		}
		result[i], open = day, true
	}
	if !open {
		return []dayHours{}, nil
	}
	return result, nil
}

func normalizePhone(input string) (string, bool) {
	var b strings.Builder
	for _, r := range input {
		switch {
		case r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == ' ' || r == '-' || r == '(' || r == ')' || r == '+' || r == '.':
		default:
			return "", false
		}
	}
	phone := b.String()
	return phone, customerPhoneDigits.MatchString(phone)
}

// openSlots lists the free start times for a service on a date, in the shop's time zone.
func openSlots(db *gorm.DB, s shop, service product, date time.Time, now time.Time) ([]time.Time, error) {
	if len(s.Hours) != 7 {
		return nil, nil
	}
	day := s.Hours[date.Weekday()]
	if day.Open == "" {
		return nil, nil
	}
	at := func(clock string) time.Time {
		t, _ := time.ParseInLocation(publicStartLayout, date.Format(publicDateLayout)+"T"+clock, date.Location())
		return t
	}
	opens, closes := at(day.Open), at(day.Close)
	duration := time.Duration(service.DurationMinutes) * time.Minute
	var taken []reservation
	err := db.Select("starts_at", "ends_at").
		Where("shop_slug = ? AND cancelled_at IS NULL", s.Slug).
		Where(clause.Lt{Column: "starts_at", Value: closes}, clause.Gt{Column: "ends_at", Value: opens}).
		Order("starts_at").Find(&taken).Error
	if err != nil {
		return nil, err
	}
	earliest := now.Add(bookingLeadTime)
	var slots []time.Time
	for start := opens; !start.Add(duration).After(closes); start = start.Add(slotStep) {
		if start.Before(earliest) {
			continue
		}
		end := start.Add(duration)
		free := true
		for _, r := range taken {
			if r.StartsAt.Before(end) && r.EndsAt.After(start) {
				free = false
				break
			}
		}
		if free {
			slots = append(slots, start)
		}
	}
	return slots, nil
}

// bookableDate parses a date in the shop zone and checks it is inside the booking horizon.
func bookableDate(input string, zone *time.Location, now time.Time) (time.Time, bool) {
	date, err := time.ParseInLocation(publicDateLayout, input, zone)
	if err != nil {
		return date, false
	}
	today, _ := time.ParseInLocation(publicDateLayout, now.In(zone).Format(publicDateLayout), zone)
	return date, !date.Before(today) && !date.After(today.AddDate(0, 0, bookingHorizonDays))
}

func publicService(db *gorm.DB, shopSlug, serviceSlug string) (shop, product, error) {
	var s shop
	var p product
	if !validSlug(shopSlug) || !validSlug(serviceSlug) {
		return s, p, gorm.ErrRecordNotFound
	}
	if err := db.Take(&s, "slug = ?", shopSlug).Error; err != nil {
		return s, p, err
	}
	err := db.Where(map[string]any{"shop_slug": shopSlug, "slug": serviceSlug, "kind": "service", "available": true, "hidden": false}).Take(&p).Error
	return s, p, err
}

type publicBookingInput struct {
	Service  string `json:"service"`
	StartsAt string `json:"startsAt"`
	Customer string `json:"customer"`
	Phone    string `json:"phone"`
}

type publicBookingResult struct {
	Service  string `json:"service"`
	StartsAt string `json:"startsAt"`
	EndsAt   string `json:"endsAt"`
}

func bookPublic(db *gorm.DB, shopSlug string, input publicBookingInput, now time.Time) (reservation, product, error) {
	var r reservation
	var service product
	zone, err := time.LoadLocation(shopTimeZone)
	if err != nil {
		return r, service, err
	}
	customer := strings.TrimSpace(input.Customer)
	if customer == "" || utf8.RuneCountInString(customer) > 160 {
		return r, service, panelValidation("Indicá tu nombre (hasta 160 caracteres)")
	}
	phone, ok := normalizePhone(input.Phone)
	if !ok {
		return r, service, panelValidation("Indicá un teléfono válido, con código de país")
	}
	start, err := time.ParseInLocation(publicStartLayout, input.StartsAt, zone)
	if err != nil {
		return r, service, panelValidation("Elegí un horario válido")
	}
	if _, ok := bookableDate(start.Format(publicDateLayout), zone, now); !ok {
		return r, service, panelValidation("Elegí una fecha dentro de los próximos 60 días")
	}
	err = withShopAgenda(db, shopSlug, func(tx *gorm.DB) error {
		var s shop
		s, service, err = publicService(tx, shopSlug, input.Service)
		if err != nil {
			return err
		}
		var recent, active int64
		if err := tx.Model(&reservation{}).Where("shop_slug = ? AND source = ? AND created_at > ?", shopSlug, publicBookingSource, now.Add(-time.Hour)).Count(&recent).Error; err != nil {
			return err
		}
		if recent >= maxWebBookingsHour {
			return panelValidation("La agenda recibió muchas reservas. Intentá de nuevo más tarde o escribí al negocio.")
		}
		if err := tx.Model(&reservation{}).Where("shop_slug = ? AND phone = ? AND cancelled_at IS NULL AND starts_at > ?", shopSlug, phone, now).Count(&active).Error; err != nil {
			return err
		}
		if active >= maxActivePerPhone {
			return panelValidation("Ya tenés citas pendientes en este negocio. Escribiles para cambiarlas.")
		}
		slots, err := openSlots(tx, s, service, start, now)
		if err != nil {
			return err
		}
		for _, slot := range slots {
			if slot.Equal(start) {
				r = reservation{ShopSlug: shopSlug, ServiceSlug: service.Slug, Customer: customer, Phone: phone,
					Source: publicBookingSource, StartsAt: start, EndsAt: start.Add(time.Duration(service.DurationMinutes) * time.Minute)}
				return tx.Create(&r).Error
			}
		}
		return errSlotTaken
	})
	return r, service, err
}

func publicBookingRoutes(mux *http.ServeMux, db *gorm.DB, delivery *resendDelivery) {
	mux.HandleFunc("GET /api/shops/{slug}/slots", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		q := db.WithContext(r.Context())
		s, service, err := publicService(q, r.PathValue("slug"), r.URL.Query().Get("service"))
		if err != nil {
			panelError(w, err)
			return
		}
		zone, err := time.LoadLocation(shopTimeZone)
		if err != nil {
			panelError(w, err)
			return
		}
		now := time.Now()
		date, ok := bookableDate(r.URL.Query().Get("date"), zone, now)
		if !ok {
			http.Error(w, "Elegí una fecha dentro de los próximos 60 días", http.StatusBadRequest)
			return
		}
		slots, err := openSlots(q, s, service, date, now)
		if err != nil {
			panelError(w, err)
			return
		}
		list := make([]string, 0, len(slots))
		for _, slot := range slots {
			list = append(list, slot.Format("15:04"))
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"slots": list})
	})

	notify := make(chan struct{}, 4)
	mux.HandleFunc("POST /api/shops/{slug}/bookings", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		var input publicBookingInput
		if !readJSON(w, r, &input, 4096) {
			return
		}
		slug := r.PathValue("slug")
		booking, service, err := bookPublic(db.WithContext(r.Context()), slug, input, time.Now())
		if errors.Is(err, errOccupied) {
			err = errSlotTaken
		}
		if err != nil {
			panelError(w, err)
			return
		}
		zone, _ := time.LoadLocation(shopTimeZone)
		if delivery != nil {
			select {
			case notify <- struct{}{}:
				go func() {
					defer func() { <-notify }()
					ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
					defer cancel()
					if err := notifyNewBooking(ctx, db, delivery, booking, service, zone); err != nil {
						log.Printf("No se pudo avisar la reserva %d: %v", booking.ID, err)
					}
				}()
			default:
				log.Printf("Aviso de la reserva %d omitido: demasiados envíos en curso", booking.ID)
			}
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(publicBookingResult{
			Service:  service.Name,
			StartsAt: booking.StartsAt.In(zone).Format(publicStartLayout),
			EndsAt:   booking.EndsAt.In(zone).Format(publicStartLayout),
		})
	})
}

func notifyNewBooking(ctx context.Context, db *gorm.DB, delivery *resendDelivery, booking reservation, service product, zone *time.Location) error {
	var emails []string
	if err := db.WithContext(ctx).Model(&shopMembership{}).Where("shop_slug = ?", booking.ShopSlug).Pluck("seller_email", &emails).Error; err != nil {
		return err
	}
	if len(emails) == 0 {
		return nil
	}
	when := booking.StartsAt.In(zone).Format("02/01/2006 15:04")
	panel := delivery.origin
	panel.Path = "/panel"
	text := "Nueva cita reservada desde la tienda en línea.\n\n" +
		"Servicio: " + service.Name + "\n" +
		"Fecha: " + when + " (hora de El Salvador)\n" +
		"Cliente: " + booking.Customer + "\n" +
		"Teléfono: +" + booking.Phone + "\n\n" +
		"Revisala o cancelala en " + panel.String()
	return delivery.send(ctx, emails, "Nueva cita: "+service.Name+" · "+when, text, "vitrina-booking/"+booking.ShopSlug+"/"+strconv.FormatUint(uint64(booking.ID), 10))
}
