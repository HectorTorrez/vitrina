package main

import (
	"errors"
	"net/http"
	"regexp"
	"slices"
	"strings"
	"unicode/utf8"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type shopMembership struct {
	SellerEmail string `gorm:"primaryKey"`
	ShopSlug    string `gorm:"primaryKey;index"`
	Seller      seller `gorm:"foreignKey:SellerEmail;references:Email;constraint:OnDelete:CASCADE"`
	Shop        shop   `gorm:"foreignKey:ShopSlug;references:Slug;constraint:OnDelete:CASCADE"`
}

type panelShop struct {
	shop
	Bookings []panelBooking `json:"bookings"`
}

type panelAccess struct {
	Email    string      `json:"email"`
	Operator bool        `json:"operator"`
	Shops    []panelShop `json:"shops"`
}

type panelInput struct {
	Booking  panelBooking
	Item     product
	Action   string
	ShopSlug string
	Email    string
	Profile  shop
}

var (
	slugPattern     = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)
	whatsappPattern = regexp.MustCompile(`^[1-9][0-9]{6,14}$`)
	handlePattern   = regexp.MustCompile(`^[A-Za-z0-9_.]{1,32}$`)
)

func validSlug(slug string) bool {
	return len(slug) <= 64 && slugPattern.MatchString(slug)
}

func panelRoutes(mux *http.ServeMux, db *gorm.DB) {
	mux.HandleFunc("GET /api/panel", authenticated(db, func(w http.ResponseWriter, r *http.Request, q *gorm.DB, account seller) {
		result, err := loadPanel(q, account)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, result)
	}))
	mux.HandleFunc("POST /api/panel", authenticated(db, func(w http.ResponseWriter, r *http.Request, q *gorm.DB, account seller) {
		var input panelInput
		if !readJSON(w, r, &input, 32*1024) {
			return
		}
		if err := changePanel(q, account, input); err != nil {
			writeError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}))
}

func loadPanel(db *gorm.DB, account seller) (panelAccess, error) {
	result := panelAccess{Email: account.Email, Operator: account.Operator, Shops: []panelShop{}}
	var shops []shop
	err := db.Preload("Products", catalogOrder).
		Where("slug IN (?)", db.Model(&shopMembership{}).Select("shop_slug").Where("seller_email = ?", account.Email)).
		Order("name, slug").Find(&shops).Error
	if err != nil {
		return result, err
	}
	bookings, err := loadPanelBookings(db, account.Email)
	if err != nil {
		return result, err
	}
	for _, s := range shops {
		shopBookings := bookings[s.Slug]
		if shopBookings == nil {
			shopBookings = []panelBooking{}
		}
		result.Shops = append(result.Shops, panelShop{shop: s, Bookings: shopBookings})
	}
	return result, nil
}

func changePanel(db *gorm.DB, account seller, input panelInput) error {
	if !validSlug(input.ShopSlug) {
		return validationError("Indicá un enlace válido para la tienda")
	}
	if input.Action == "crear-tienda" {
		if !account.Operator {
			// Sellers without a shop (for example when their link was taken) can open their own.
			var owned int64
			if err := db.Model(&shopMembership{}).Where("seller_email = ?", account.Email).Count(&owned).Error; err != nil {
				return err
			}
			if owned > 0 {
				return errForbidden
			}
			input.Email = account.Email
		}
		return createPanelShop(db, input)
	}
	var membership shopMembership
	err := db.Take(&membership, "seller_email = ? AND shop_slug = ?", account.Email, input.ShopSlug).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return errForbidden
	}
	if err != nil {
		return err
	}
	switch input.Action {
	case "editar-tienda":
		profile, err := validatedProfile(input.Profile)
		if err != nil {
			return err
		}
		return db.Model(&shop{}).Where("slug = ?", input.ShopSlug).
			Select("name", "description", "theme", "accent_color", "logo_url", "background_url", "instagram", "tiktok", "whatsapp", "hours").Updates(&profile).Error
	case "crear-item", "editar-item":
		return savePanelItem(db, input.ShopSlug, input.Item, input.Action == "crear-item")
	case "eliminar-item":
		return deletePanelItem(db, input.ShopSlug, input.Item.Slug)
	case "agendar", "reprogramar", "cancelar":
		return changePanelBooking(db, input)
	default:
		return validationError("Acción inválida")
	}
}

func createPanelShop(db *gorm.DB, input panelInput) error {
	email, valid := sellerEmail(input.Email)
	if !valid {
		return validationError("Indicá un correo válido para el vendedor")
	}
	profile, err := validatedProfile(input.Profile)
	if err != nil {
		return err
	}
	profile.Slug = input.ShopSlug
	return db.Transaction(func(tx *gorm.DB) error {
		result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&profile)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return errConflict
		}
		if err := ensureSeller(tx, email); err != nil {
			return err
		}
		return tx.Create(&shopMembership{SellerEmail: email, ShopSlug: profile.Slug}).Error
	})
}

// Keep in sync with the themes in web/src/themes.ts.
var themes = []string{"costa", "arena", "noche", "lienzo", "rosa", "sol", "cielo", "lavanda", "bosque"}

var accentPattern = regexp.MustCompile(`^#[0-9a-f]{6}$`)

func validatedProfile(input shop) (shop, error) {
	profile := shop{
		Name:          strings.TrimSpace(input.Name),
		Description:   strings.TrimSpace(input.Description),
		Theme:         input.Theme,
		AccentColor:   strings.ToLower(input.AccentColor),
		LogoURL:       input.LogoURL,
		BackgroundURL: input.BackgroundURL,
		Instagram:     strings.TrimPrefix(strings.TrimSpace(input.Instagram), "@"),
		TikTok:        strings.TrimPrefix(strings.TrimSpace(input.TikTok), "@"),
	}
	hours, err := validatedHours(input.Hours)
	if err != nil {
		return shop{}, err
	}
	profile.Hours = hours
	if profile.Name == "" || utf8.RuneCountInString(profile.Name) > 100 || utf8.RuneCountInString(profile.Description) > 500 {
		return shop{}, validationError("Indicá un nombre de hasta 100 caracteres y una descripción de hasta 500")
	}
	for _, path := range []string{profile.LogoURL, profile.BackgroundURL} {
		if path != "" && !validMediaPath(path) {
			return shop{}, validationError("Subí una imagen válida para tu tienda")
		}
	}
	if profile.AccentColor != "" && !accentPattern.MatchString(profile.AccentColor) {
		return shop{}, validationError("Elegí un color principal válido")
	}
	if !slices.Contains(themes, profile.Theme) {
		return shop{}, validationError("Elegí un tema válido")
	}
	for _, handle := range []string{profile.Instagram, profile.TikTok} {
		if handle != "" && !handlePattern.MatchString(handle) {
			return shop{}, validationError("Ingresá los usuarios de Instagram y TikTok sin la dirección web")
		}
	}
	if whatsapp := strings.TrimSpace(input.Whatsapp); whatsapp != "" {
		phone := strings.TrimPrefix(whatsapp, "+")
		if !whatsappPattern.MatchString(phone) {
			return shop{}, validationError("Ingresá el número de WhatsApp en formato internacional")
		}
		profile.Whatsapp = phone
	}
	return profile, nil
}
