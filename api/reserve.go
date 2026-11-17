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
	var r reservation
	err := db.Transaction(func(tx *gorm.DB) error {
		// Serialize all bookings in this shop, including concurrent bookings for different services.
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where(map[string]any{"slug": slug}).Take(&shop{}).Error; err != nil {
			return err
		}
		var p product
		if err := tx.Where(map[string]any{"shop_slug": slug, "slug": service, "kind": "service", "available": true}).Take(&p).Error; err != nil {
			return err
		}
		end := start.Add(time.Duration(p.DurationMinutes) * time.Minute)
		var count int64
		if err := tx.Model(&reservation{}).Where(map[string]any{"shop_slug": slug}).Where(clause.Lt{Column: "starts_at", Value: end}, clause.Gt{Column: "ends_at", Value: start}).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return errOccupied
		}
		r = reservation{ShopSlug: slug, ServiceSlug: service, Customer: customer, StartsAt: start, EndsAt: end}
		return tx.Create(&r).Error
	})
	return r, err
}
