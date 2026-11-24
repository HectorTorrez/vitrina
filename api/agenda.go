package main

import (
	"errors"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	errOccupied = errors.New("el horario se cruza con otra reserva")
	phoneDigits = regexp.MustCompile(`^[1-9][0-9]{7,14}$`)
)

func cleanCustomer(name string) (string, error) {
	customer := strings.TrimSpace(name)
	if customer == "" || utf8.RuneCountInString(customer) > 160 {
		return "", validationError("Indicá un nombre de hasta 160 caracteres")
	}
	return customer, nil
}

// normalizePhone returns the international digits of a phone number written with the usual
// separators. Eight-digit numbers are local to El Salvador and get its country code.
func normalizePhone(input string) (string, bool) {
	var b strings.Builder
	for _, r := range input {
		switch {
		case r >= '0' && r <= '9':
			b.WriteRune(r)
		case strings.ContainsRune(" -().+", r):
		default:
			return "", false
		}
	}
	phone := b.String()
	if len(phone) == 8 {
		phone = "503" + phone
	}
	return phone, phoneDigits.MatchString(phone)
}

func bookableService(db *gorm.DB, shopSlug, slug string) (product, error) {
	var p product
	err := db.Where(map[string]any{"shop_slug": shopSlug, "slug": slug, "kind": "service", "available": true, "hidden": false}).Take(&p).Error
	return p, err
}

// withShopAgenda runs change while holding the shop's row lock, so concurrent bookings see each other.
func withShopAgenda(db *gorm.DB, slug string, change func(*gorm.DB) error) error {
	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("slug = ?", slug).Take(&shop{}).Error; err != nil {
			return err
		}
		return change(tx)
	})
}

func activeBooking(db *gorm.DB, slug string, id uint, booking *reservation) error {
	return db.Take(booking, "shop_slug = ? AND id = ? AND cancelled_at IS NULL", slug, id).Error
}

// saveBooking creates a booking (id 0) or moves an active future one, rejecting overlaps.
func saveBooking(db *gorm.DB, slug, service string, start time.Time, customer, phone, staffID string, id uint) (reservation, error) {
	var r reservation
	err := withShopAgenda(db, slug, func(tx *gorm.DB) error {
		var s shop
		if err := tx.Take(&s, "slug = ?", slug).Error; err != nil {
			return err
		}
		staffID = strings.TrimSpace(staffID)
		if staffID != "" {
			if _, ok := s.findStaff(staffID); !ok {
				return validationError("Elegí un especialista válido")
			}
		}
		if id != 0 {
			if err := activeBooking(tx, slug, id, &r); err != nil {
				return err
			}
			if !r.StartsAt.After(time.Now()) {
				return validationError("Solo podés reprogramar citas futuras")
			}
		}
		duration := r.EndsAt.Sub(r.StartsAt)
		if id == 0 || r.ServiceSlug != service {
			p, err := bookableService(tx, slug, service)
			if err != nil {
				return err
			}
			duration = time.Duration(p.DurationMinutes) * time.Minute
		}
		end := start.Add(duration)
		var count int64
		overlaps := tx.Model(&reservation{}).Where("shop_slug = ? AND cancelled_at IS NULL AND id <> ?", slug, id).
			Where(clause.Lt{Column: "starts_at", Value: end}, clause.Gt{Column: "ends_at", Value: start})
		if staffID != "" {
			overlaps = overlaps.Where("staff_id = ?", staffID)
		} else if len(s.Staff) > 0 {
			overlaps = overlaps.Where("staff_id = ''")
		}
		if err := overlaps.Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return errOccupied
		}
		if id == 0 {
			token := newManageToken()
			r = reservation{
				ShopSlug: slug, ServiceSlug: service, StaffID: staffID,
				Customer: customer, Phone: phone, Source: "panel",
				ManageToken: &token, StartsAt: start, EndsAt: end,
			}
			return tx.Create(&r).Error
		}
		r.ServiceSlug = service
		r.StaffID = staffID
		r.Customer = customer
		r.Phone = phone
		r.StartsAt = start
		r.EndsAt = end
		r.Reminder1SentAt = nil
		r.Reminder2SentAt = nil
		return tx.Model(&r).Select("service_slug", "staff_id", "customer", "phone", "starts_at", "ends_at", "reminder1_sent_at", "reminder2_sent_at").Updates(&r).Error
	})
	return r, err
}
