package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	slotStep            = 15 * time.Minute
	bookingLeadTime     = time.Hour
	bookingHorizonDays  = 60
	maxActivePerPhone   = 2
	maxWebBookingsHour  = 30
	localDate           = "2006-01-02"
	publicBookingSource = "web"
)

var (
	clockPattern      = regexp.MustCompile(`^([01][0-9]|2[0-3]):[0-5][0-9]$`)
	errSlotTaken      = validationError("Ese horario ya no está disponible. Elegí otro.")
	errOutsideHorizon = validationError(fmt.Sprintf("Elegí una fecha dentro de los próximos %d días", bookingHorizonDays))
)

// validatedHours normalizes a weekly schedule: either empty (online booking off) or seven days.
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
		day.Open, day.Close = strings.TrimSpace(day.Open), strings.TrimSpace(day.Close)
		if day.Open == "" && day.Close == "" {
			continue
		}
		if !clockPattern.MatchString(day.Open) || !clockPattern.MatchString(day.Close) || day.Open >= day.Close {
			return nil, validationError("Cada día abierto necesita una hora de apertura anterior a la de cierre")
		}
		result[i], open = day, true
	}
	if !open {
		return []dayHours{}, nil
	}
	return result, nil
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
		t, _ := time.ParseInLocation(localMinute, date.Format(localDate)+"T"+clock, shopZone)
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

// bookableDate parses a shop-local date inside the booking horizon.
func bookableDate(input string, now time.Time) (time.Time, error) {
	date, err := time.ParseInLocation(localDate, input, shopZone)
	if err != nil {
		return date, errOutsideHorizon
	}
	today, _ := time.ParseInLocation(localDate, now.In(shopZone).Format(localDate), shopZone)
	if date.Before(today) || date.After(today.AddDate(0, 0, bookingHorizonDays)) {
		return date, errOutsideHorizon
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
	customer, err := cleanCustomer(input.Customer)
	if err != nil {
		return r, service, err
	}
	phone, ok := normalizePhone(input.Phone)
	if !ok {
		return r, service, validationError("Indicá un teléfono válido, con código de país")
	}
	start, err := time.ParseInLocation(localMinute, input.StartsAt, shopZone)
	if err != nil {
		return r, service, validationError("Elegí un horario válido")
	}
	if _, err := bookableDate(start.Format(localDate), now); err != nil {
		return r, service, err
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
		q := db.WithContext(r.Context())
		s, service, err := publicService(q, r.PathValue("slug"), r.URL.Query().Get("service"))
		if err != nil {
			writeError(w, err)
			return
		}
		now := time.Now()
		date, err := bookableDate(r.URL.Query().Get("date"), now)
		if err != nil {
			writeError(w, err)
			return
		}
		slots, err := openSlots(q, s, service, date, now)
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

	notify := make(chan struct{}, 4)
	mux.HandleFunc("POST /api/shops/{slug}/bookings", func(w http.ResponseWriter, r *http.Request) {
		var input publicBookingInput
		if !readJSON(w, r, &input, 4096) {
			return
		}
		booking, service, err := bookPublic(db.WithContext(r.Context()), r.PathValue("slug"), input, time.Now())
		if err != nil {
			writeError(w, err)
			return
		}
		if delivery != nil {
			select {
			case notify <- struct{}{}:
				go func() {
					defer func() { <-notify }()
					ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
					defer cancel()
					if err := notifyNewBooking(ctx, db, delivery, booking, service); err != nil {
						log.Printf("No se pudo avisar la reserva %d: %v", booking.ID, err)
					}
				}()
			default:
				log.Printf("Aviso de la reserva %d omitido: demasiados envíos en curso", booking.ID)
			}
		}
		writeJSON(w, http.StatusCreated, publicBookingResult{
			Service:  service.Name,
			StartsAt: booking.StartsAt.In(shopZone).Format(localMinute),
			EndsAt:   booking.EndsAt.In(shopZone).Format(localMinute),
		})
	})
}

func notifyNewBooking(ctx context.Context, db *gorm.DB, delivery *resendDelivery, booking reservation, service product) error {
	var emails []string
	if err := db.WithContext(ctx).Model(&shopMembership{}).Where("shop_slug = ?", booking.ShopSlug).Pluck("seller_email", &emails).Error; err != nil {
		return err
	}
	if len(emails) == 0 {
		return nil
	}
	when := booking.StartsAt.In(shopZone).Format("02/01/2006 15:04")
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
