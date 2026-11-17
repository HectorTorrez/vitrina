package main

import (
	"errors"
	"fmt"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"strings"
	"time"
)

var errOccupied = errors.New("el horario se cruza con otra reserva")

func reserveCommand(db *gorm.DB, args []string) error {
	if len(args) != 4 {
		return errors.New("uso: reservar TIENDA SERVICIO INICIO_RFC3339 CLIENTE")
	}
	start, err := time.Parse(time.RFC3339, args[2])
	if err != nil {
		return errors.New("indicá fecha, hora y zona horaria en formato RFC3339")
	}
	customer := strings.TrimSpace(args[3])
	if !start.After(time.Now()) || customer == "" || len([]rune(customer)) > 160 {
		return errors.New("indicá un horario futuro y un nombre de cliente de hasta 160 caracteres")
	}
	r, err := book(db, args[0], args[1], start, customer)
	if err == nil {
		fmt.Printf("Reserva %d confirmada hasta %s\n", r.ID, r.EndsAt.Format(time.RFC3339))
	}
	return err
}
func book(db *gorm.DB, slug, service string, start time.Time, customer string) (reservation, error) {
	return saveBooking(db, slug, service, start, customer, 0)
}

func saveBooking(db *gorm.DB, slug, service string, start time.Time, customer string, id uint) (reservation, error) {
	var r reservation
	err := withShopAgenda(db, slug, func(tx *gorm.DB) error {
		if id != 0 {
			if err := activeBooking(tx, slug, id, &r); err != nil {
				return err
			}
			if !r.StartsAt.After(time.Now()) {
				return panelValidation("Solo podés reprogramar citas futuras")
			}
		}
		duration := r.EndsAt.Sub(r.StartsAt)
		if id == 0 || r.ServiceSlug != service {
			var p product
			if err := tx.Where(map[string]any{"shop_slug": slug, "slug": service, "kind": "service", "available": true, "hidden": false}).Take(&p).Error; err != nil {
				return err
			}
			duration = time.Duration(p.DurationMinutes) * time.Minute
		}
		end := start.Add(duration)
		var count int64
		overlaps := tx.Model(&reservation{}).Where("shop_slug = ? AND cancelled_at IS NULL AND id <> ?", slug, id).
			Where(clause.Lt{Column: "starts_at", Value: end}, clause.Gt{Column: "ends_at", Value: start})
		if err := overlaps.Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return errOccupied
		}
		r = reservation{ID: id, ShopSlug: slug, ServiceSlug: service, Customer: customer, StartsAt: start, EndsAt: end}
		if id == 0 {
			return tx.Create(&r).Error
		}
		return tx.Model(&r).Select("service_slug", "customer", "starts_at", "ends_at").Updates(&r).Error
	})
	return r, err
}

func withShopAgenda(db *gorm.DB, slug string, change func(*gorm.DB) error) error {
	return db.Transaction(func(tx *gorm.DB) error {
		// Every booking change takes the same shop lock before reading the agenda.
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("slug = ?", slug).Take(&shop{}).Error; err != nil {
			return err
		}
		return change(tx)
	})
}

func activeBooking(db *gorm.DB, slug string, id uint, booking *reservation) error {
	return db.Take(booking, "shop_slug = ? AND id = ? AND cancelled_at IS NULL", slug, id).Error
}
