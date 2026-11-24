package main

import (
	"strings"
	"time"

	"gorm.io/gorm"
)

type panelBooking struct {
	ID          uint   `json:"id"`
	ServiceSlug string `json:"serviceSlug"`
	StaffID     string `json:"staffId,omitempty"`
	StaffName   string `json:"staffName,omitempty"`
	Customer    string `json:"customer"`
	Phone       string `json:"phone"`
	Email       string `json:"email,omitempty"`
	Notes       string `json:"notes"`
	Source      string `json:"source"`
	ManageToken string `json:"manageToken,omitempty"`
	StartsAt    string `json:"startsAt"`
	EndsAt      string `json:"endsAt"`
	Cancelled   bool   `json:"cancelled"`
	Editable    bool   `json:"editable"`
}

func loadPanelBookings(db *gorm.DB, email string, zones map[string]*time.Location, shopsBySlug map[string]shop) (map[string][]panelBooking, error) {
	var bookings []reservation
	err := db.Where("shop_slug IN (?)", db.Model(&shopMembership{}).Select("shop_slug").Where("seller_email = ?", email)).
		Order("starts_at, id").Find(&bookings).Error
	if err != nil {
		return nil, err
	}
	now := time.Now()
	result := make(map[string][]panelBooking)
	for _, r := range bookings {
		loc := zones[r.ShopSlug]
		if loc == nil {
			loc = shopZone
		}
		token := ""
		if r.ManageToken != nil {
			token = *r.ManageToken
		}
		result[r.ShopSlug] = append(result[r.ShopSlug], panelBooking{
			ID:          r.ID,
			ServiceSlug: r.ServiceSlug,
			StaffID:     r.StaffID,
			StaffName:   shopsBySlug[r.ShopSlug].staffName(r.StaffID),
			Customer:    r.Customer,
			Phone:       r.Phone,
			Email:       r.Email,
			Notes:       r.Notes,
			Source:      r.Source,
			ManageToken: token,
			StartsAt:    r.StartsAt.In(loc).Format(localMinute),
			EndsAt:      r.EndsAt.In(loc).Format(localMinute),
			Cancelled:   r.CancelledAt != nil,
			Editable:    r.CancelledAt == nil && r.StartsAt.After(now),
		})
	}
	return result, nil
}

func changePanelBooking(db *gorm.DB, input panelInput) error {
	booking := input.Booking
	if (input.Action == "agendar") != (booking.ID == 0) {
		return validationError("Indicá una cita válida")
	}
	if input.Action == "cancelar" {
		return withShopAgenda(db, input.ShopSlug, func(tx *gorm.DB) error {
			var r reservation
			if err := activeBooking(tx, input.ShopSlug, booking.ID, &r); err != nil {
				return err
			}
			now := time.Now()
			if !r.StartsAt.After(now) {
				return validationError("Solo podés cancelar citas futuras")
			}
			return tx.Model(&r).Update("cancelled_at", now).Error
		})
	}
	var s shop
	_ = db.Select("timezone").Take(&s, "slug = ?", input.ShopSlug).Error
	start, err := time.ParseInLocation(localMinute, booking.StartsAt, s.location())
	if err != nil || !start.After(time.Now()) || !validSlug(booking.ServiceSlug) {
		return validationError("Elegí un servicio y una fecha futura")
	}
	customer, err := cleanCustomer(booking.Customer)
	if err != nil {
		return err
	}
	phone := ""
	if strings.TrimSpace(booking.Phone) != "" {
		var ok bool
		if phone, ok = normalizePhone(booking.Phone); !ok {
			return validationError("Indicá un teléfono válido, con código de país")
		}
	}
	_, err = saveBooking(db, input.ShopSlug, booking.ServiceSlug, start, customer, phone, booking.StaffID, booking.ID)
	return err
}
