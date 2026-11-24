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
			return errConflict
		}
		return result.Error
	}
	result := db.Model(&product{}).Where("shop_slug = ? AND slug = ? AND kind = ?", shopSlug, item.Slug, item.Kind).
		Select("name", "description", "category", "badge", "price_cents", "compare_at_cents", "available", "image_url", "gallery", "options", "position", "hidden", "duration_minutes").Updates(&item)
	if result.Error == nil && result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return result.Error
}

const (
	maxItemDescription = 2000
	maxGalleryPhotos   = 8
)

// validImageURL accepts an uploaded photo or a public HTTPS image.
func validImageURL(raw string) bool {
	if validMediaPath(raw) {
		return true
	}
	parsed, err := url.Parse(raw)
	return err == nil && len(raw) <= 2048 && parsed.Scheme == "https" && parsed.Hostname() != "" && parsed.User == nil
}

func validatePanelItem(item *product) error {
	item.Name = strings.TrimSpace(item.Name)
	item.ImageURL = strings.TrimSpace(item.ImageURL)
	item.Description = strings.TrimSpace(item.Description)
	item.Category = strings.TrimSpace(item.Category)
	item.Badge = strings.ToLower(strings.TrimSpace(item.Badge))
	if !validSlug(item.Slug) || item.Name == "" || utf8.RuneCountInString(item.Name) > 120 {
		return validationError("Indicá un nombre y un enlace válido para la ficha")
	}
	if utf8.RuneCountInString(item.Category) > 40 {
		return validationError("La categoría puede tener hasta 40 caracteres")
	}
	if item.Badge != "" && item.Badge != "new" && item.Badge != "popular" && item.Badge != "sale" {
		return validationError("Elegí una etiqueta válida")
	}
	if item.PriceCents < 0 || item.PriceCents > 99999999 || item.CompareAtCents < 0 || item.CompareAtCents > 99999999 || item.Position < 0 || item.Position > 999999 {
		return validationError("Revisá el precio y la posición")
	}
	switch item.Kind {
	case "product":
		item.DurationMinutes = 0
	case "service":
		if item.DurationMinutes < 1 || item.DurationMinutes > 1440 {
			return validationError("La duración del servicio debe estar entre 1 y 1440 minutos")
		}
	default:
		return validationError("Elegí producto o servicio")
	}
	if utf8.RuneCountInString(item.Description) > maxItemDescription {
		return validationError("La descripción puede tener hasta 2000 caracteres")
	}
	if item.ImageURL != "" && !validImageURL(item.ImageURL) {
		return validationError("Subí una foto o ingresá una URL HTTPS válida")
	}
	if len(item.Gallery) > maxGalleryPhotos {
		return validationError("Podés agregar hasta 8 fotos adicionales")
	}
	for i, photo := range item.Gallery {
		photo = strings.TrimSpace(photo)
		if !validImageURL(photo) {
			return validationError("Revisá las fotos adicionales: subilas de nuevo o usá URLs HTTPS válidas")
		}
		item.Gallery[i] = photo
	}
	if item.Gallery == nil {
		item.Gallery = []string{}
	}
	if len(item.Options) > 8 {
		return validationError("Podés agregar hasta 8 grupos de variantes")
	}
	names := make(map[string]bool)
	for index := range item.Options {
		group := &item.Options[index]
		group.Name = strings.TrimSpace(group.Name)
		if group.Name == "" || utf8.RuneCountInString(group.Name) > 60 || names[group.Name] || len(group.Values) == 0 || len(group.Values) > 12 {
			return validationError("Cada grupo necesita un nombre único y de 1 a 12 opciones")
		}
		names[group.Name] = true
		values := make(map[string]bool)
		for i, value := range group.Values {
			value = strings.TrimSpace(value)
			if value == "" || utf8.RuneCountInString(value) > 60 || values[value] {
				return validationError("Usá opciones únicas de hasta 60 caracteres")
			}
			group.Values[i] = value
			values[value] = true
		}
		if len(group.Prices) != 0 && len(group.Prices) != len(group.Values) {
			return validationError("Indicá un recargo por cada opción")
		}
		surcharge := false
		for _, cents := range group.Prices {
			if cents < 0 || cents > 99999999 {
				return validationError("Los recargos deben ser de 0 a 999999.99")
			}
			surcharge = surcharge || cents > 0
		}
		if !surcharge {
			group.Prices = nil
		}
	}
	if item.Options == nil {
		item.Options = []option{}
	}
	return nil
}

// Booked services keep their history, so they can only be hidden.
func deletePanelItem(db *gorm.DB, shopSlug, slug string) error {
	if !validSlug(slug) {
		return validationError("Indicá una ficha válida")
	}
	return withShopAgenda(db, shopSlug, func(tx *gorm.DB) error {
		var count int64
		if err := tx.Model(&reservation{}).Where("shop_slug = ? AND service_slug = ?", shopSlug, slug).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return validationError("Este servicio tiene citas registradas. Ocultalo del catálogo en lugar de eliminarlo.")
		}
		result := tx.Where("shop_slug = ? AND slug = ?", shopSlug, slug).Delete(&product{})
		if result.Error == nil && result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return result.Error
	})
}
