package main

import (
	"net/url"
	"strings"
	"unicode/utf8"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func savePanelItem(db *gorm.DB, shopSlug string, item product, create bool) error {
	item.ShopSlug = shopSlug
	item.Artwork = ""
	if err := validatePanelItem(&item); err != nil {
		return err
	}
	if create {
		result := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&item)
		if result.Error == nil && result.RowsAffected == 0 {
			return errPanelConflict
		}
		return result.Error
	}
	result := db.Model(&product{}).Where("shop_slug = ? AND slug = ? AND kind = ?", shopSlug, item.Slug, item.Kind).
		Select("name", "price_cents", "available", "image_url", "options", "position", "hidden", "duration_minutes").Updates(&item)
	if result.Error == nil && result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return result.Error
}

func validatePanelItem(item *product) error {
	item.Name = strings.TrimSpace(item.Name)
	item.ImageURL = strings.TrimSpace(item.ImageURL)
	if !validSlug(item.Slug) || item.Name == "" || utf8.RuneCountInString(item.Name) > 120 {
		return panelValidation("Indicá un nombre y un enlace válido para la ficha")
	}
	if item.PriceCents < 0 || item.PriceCents > 99999999 || item.Position < 0 || item.Position > 999999 {
		return panelValidation("Revisá el precio y la posición")
	}
	switch item.Kind {
	case "product":
		item.DurationMinutes = 0
	case "service":
		if item.DurationMinutes < 1 || item.DurationMinutes > 1440 {
			return panelValidation("La duración del servicio debe estar entre 1 y 1440 minutos")
		}
	default:
		return panelValidation("Elegí producto o servicio")
	}
	if item.ImageURL != "" && !validMediaPath(item.ImageURL) {
		imageURL, err := url.Parse(item.ImageURL)
		if err != nil || len(item.ImageURL) > 2048 || imageURL.Scheme != "https" || imageURL.Hostname() == "" || imageURL.User != nil {
			return panelValidation("Subí una foto o ingresá una URL HTTPS válida")
		}
	}
	if len(item.Options) > 8 {
		return panelValidation("Podés agregar hasta 8 grupos de variantes")
	}
	names := make(map[string]bool)
	for index := range item.Options {
		group := &item.Options[index]
		group.Name = strings.TrimSpace(group.Name)
		if group.Name == "" || utf8.RuneCountInString(group.Name) > 60 || names[group.Name] || len(group.Values) == 0 || len(group.Values) > 12 {
			return panelValidation("Cada grupo necesita un nombre único y de 1 a 12 opciones")
		}
		names[group.Name] = true
		values := make(map[string]bool)
		for i, value := range group.Values {
			value = strings.TrimSpace(value)
			if value == "" || utf8.RuneCountInString(value) > 60 || values[value] {
				return panelValidation("Usá opciones únicas de hasta 60 caracteres")
			}
			group.Values[i] = value
			values[value] = true
		}
	}
	if item.Options == nil {
		item.Options = []option{}
	}
	return nil
}
