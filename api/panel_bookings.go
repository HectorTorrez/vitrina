package main

import (
	"strings"
	"time"
	"unicode/utf8"

	"gorm.io/gorm"
)

const shopTimeZone = "America/El_Salvador"

type panelBooking struct {
	ID          uint   `json:"id"`
	ServiceSlug string `json:"serviceSlug"`
	Customer    string `json:"customer"`
	Phone       string `json:"phone"`
	Source      string `json:"source"`
	StartsAt    string `json:"startsAt"`
	EndsAt      string `json:"endsAt"`
	Cancelled   bool   `json:"cancelled"`
	Editable    bool   `json:"editable"`
}

func loadPanelBookings(db *gorm.DB, email string) (map[string][]panelBooking, error) {
	var bookings []reservation
	err := db.Where("shop_slug IN (?)", db.Model(&shopMembership{}).Select("shop_slug").Where("seller_email = ?", email)).
		Order("starts_at, id").Find(&bookings).Error
	if err != nil {
		return nil, err
	}
	zone, err := time.LoadLocation(shopTimeZone)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	result := make(map[string][]panelBooking)
	for _, r := range bookings {
		result[r.ShopSlug] = append(result[r.ShopSlug], panelBooking{
			ID:          r.ID,
			ServiceSlug: r.ServiceSlug,
			Customer:    r.Customer,
			Phone:       r.Phone,
			Source:      r.Source,
			StartsAt:    r.StartsAt.In(zone).Format("2006-01-02T15:04"),
			EndsAt:      r.EndsAt.In(zone).Format("2006-01-02T15:04"),
			Cancelled:   r.CancelledAt != nil,
			Editable:    r.CancelledAt == nil && r.StartsAt.After(now),
		})
	}
	return result, nil
}

func changePanelBooking(db *gorm.DB, input panelInput) error {
	booking := input.Booking
	if (input.Action == "agendar") != (booking.ID == 0) {
		return panelValidation("Indicá una cita válida")
	}
	if input.Action == "cancelar" {
		return withShopAgenda(db, input.ShopSlug, func(tx *gorm.DB) error {
			var r reservation
			if err := activeBooking(tx, input.ShopSlug, booking.ID, &r); err != nil {
				return err
			}
			now := time.Now()
			if !r.StartsAt.After(now) {
				return panelValidation("Solo podés cancelar citas futuras")
			}
			return tx.Model(&r).Update("cancelled_at", now).Error
		})
	}
	zone, err := time.LoadLocation(shopTimeZone)
	if err != nil {
		return err
	}
	start, err := time.ParseInLocation("2006-01-02T15:04", booking.StartsAt, zone)
	customer := strings.TrimSpace(booking.Customer)
	if err != nil || !start.After(time.Now()) || !validSlug(booking.ServiceSlug) || customer == "" || utf8.RuneCountInString(customer) > 160 {
		return panelValidation("Elegí un servicio, una fecha futura y un nombre de cliente de hasta 160 caracteres")
	}
	phone := ""
	if strings.TrimSpace(booking.Phone) != "" {
		var ok bool
		if phone, ok = normalizePhone(booking.Phone); !ok {
			return panelValidation("Indicá un teléfono válido, con código de país")
		}
	}
	_, err = saveBooking(db, input.ShopSlug, booking.ServiceSlug, start, customer, phone, booking.ID)
	return err
}
