package main

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"
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
	Bookings []panelBooking `json:"bookings"`
	shop
	Slug string `json:"slug"`
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
	errPanelForbidden = errors.New("No tenés permiso para realizar esta acción")
	errPanelConflict  = errors.New("Ese enlace ya está en uso")
	slugPattern       = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)
	handlePattern     = regexp.MustCompile(`^[A-Za-z0-9_.]{1,32}$`)
	phonePattern      = regexp.MustCompile(`^[1-9][0-9]{6,14}$`)
)

func validSlug(slug string) bool {
	return len(slug) <= 64 && slugPattern.MatchString(slug)
}

func lookupSession(db *gorm.DB, r *http.Request) (sellerSession, error) {
	var session sellerSession
	cookie, err := r.Cookie(sessionCookie)
	if err != nil || !strings.HasPrefix(cookie.Value, sessionPrefix) {
		return session, gorm.ErrRecordNotFound
	}
	err = db.First(&session, "token_hash = ? AND expires_at > ?", tokenHash(cookie.Value), time.Now()).Error
	return session, err
}

func panelRoutes(mux *http.ServeMux, db *gorm.DB) {
	handle := func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "private, no-store")
		q := db.WithContext(r.Context())
		session, err := lookupSession(q, r)
		if errors.Is(err, gorm.ErrRecordNotFound) {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		if err != nil {
			panelError(w, err)
			return
		}
		var account seller
		if err := q.Take(&account, "email = ?", session.SellerEmail).Error; err != nil {
			panelError(w, err)
			return
		}
		if r.Method == http.MethodGet {
			result, err := loadPanel(q, account)
			if err != nil {
				panelError(w, err)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(result)
			return
		}
		var input panelInput
		if !readAuthJSON(w, r, &input) {
			return
		}
		if err := changePanel(q, account, input); err != nil {
			panelError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
	mux.HandleFunc("GET /api/panel", handle)
	mux.HandleFunc("POST /api/panel", handle)
}

func loadPanel(db *gorm.DB, account seller) (panelAccess, error) {
	result := panelAccess{Email: account.Email, Operator: account.Operator, Shops: []panelShop{}}
	var shops []shop
	err := db.Preload("Products", func(q *gorm.DB) *gorm.DB { return q.Order("position, slug") }).
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
		result.Shops = append(result.Shops, panelShop{shop: s, Slug: s.Slug, Bookings: bookings[s.Slug]})
	}
	return result, nil
}

type panelValidation string

func (e panelValidation) Error() string { return string(e) }

func panelError(w http.ResponseWriter, err error) {
	var validation panelValidation
	switch {
	case errors.As(err, &validation):
		http.Error(w, err.Error(), http.StatusBadRequest)
	case errors.Is(err, errPanelForbidden):
		http.Error(w, err.Error(), http.StatusForbidden)
	case errors.Is(err, errPanelConflict), errors.Is(err, errOccupied):
		http.Error(w, err.Error(), http.StatusConflict)
	case errors.Is(err, gorm.ErrRecordNotFound):
		http.Error(w, "No se encontró el registro solicitado", http.StatusNotFound)
	default:
		log.Print(err)
		http.Error(w, "No se pudo completar la operación", http.StatusInternalServerError)
	}
}

func changePanel(db *gorm.DB, account seller, input panelInput) error {
	if !validSlug(input.ShopSlug) {
		return panelValidation("Indicá un enlace válido para la tienda")
	}
	if input.Action == "crear-tienda" {
		if !account.Operator {
			return errPanelForbidden
		}
		return createPanelShop(db, input)
	}
	var membership shopMembership
	err := db.Take(&membership, "seller_email = ? AND shop_slug = ?", account.Email, input.ShopSlug).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return errPanelForbidden
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
			Select("name", "description", "theme", "instagram", "tiktok", "whatsapp").Updates(&profile).Error
	case "crear-item", "editar-item":
		return savePanelItem(db, input.ShopSlug, input.Item, input.Action == "crear-item")
	case "agendar", "reprogramar", "cancelar":
		return changePanelBooking(db, input)
	default:
		return panelValidation("Acción inválida")
	}
}

func createPanelShop(db *gorm.DB, input panelInput) error {
	email, valid := sellerEmail(input.Email)
	if !valid {
		return panelValidation("Indicá un correo válido para el vendedor")
	}
	profile, err := validatedProfile(input.Profile)
	if err != nil {
		return err
	}
	profile.Slug = input.ShopSlug
	return db.Transaction(func(tx *gorm.DB) error {
		ignoreConflict := clause.OnConflict{DoNothing: true}
		result := tx.Clauses(ignoreConflict).Create(&profile)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return errPanelConflict
		}
		if err := tx.Clauses(ignoreConflict).Create(&seller{Email: email}).Error; err != nil {
			return err
		}
		return tx.Create(&shopMembership{SellerEmail: email, ShopSlug: profile.Slug}).Error
	})
}

func validatedProfile(input shop) (shop, error) {
	profile := shop{
		Name:        strings.TrimSpace(input.Name),
		Description: strings.TrimSpace(input.Description),
		Theme:       input.Theme,
		Instagram:   strings.TrimPrefix(strings.TrimSpace(input.Instagram), "@"),
		TikTok:      strings.TrimPrefix(strings.TrimSpace(input.TikTok), "@"),
		Whatsapp:    strings.TrimPrefix(strings.TrimSpace(input.Whatsapp), "+"),
	}
	if profile.Name == "" || utf8.RuneCountInString(profile.Name) > 100 || utf8.RuneCountInString(profile.Description) > 500 {
		return shop{}, panelValidation("Indicá un nombre de hasta 100 caracteres y una descripción de hasta 500")
	}
	switch profile.Theme {
	case "costa", "arena", "noche":
	default:
		return shop{}, panelValidation("Elegí un tema válido")
	}
	for _, handle := range []string{profile.Instagram, profile.TikTok} {
		if handle != "" && !handlePattern.MatchString(handle) {
			return shop{}, panelValidation("Ingresá los usuarios de Instagram y TikTok sin la dirección web")
		}
	}
	if profile.Whatsapp != "" && !phonePattern.MatchString(profile.Whatsapp) {
		return shop{}, panelValidation("Ingresá el número de WhatsApp en formato internacional")
	}
	return profile, nil
}

func grantPanelAccess(db *gorm.DB, args []string, operator bool) error {
	if operator {
		return db.Transaction(func(tx *gorm.DB) error {
			if err := createSeller(tx, args); err != nil {
				return err
			}
			email, _ := sellerEmail(args[0])
			return tx.Model(&seller{}).Where("email = ?", email).Update("operator", true).Error
		})
	}
	if len(args) != 2 || !validSlug(args[1]) {
		return errors.New("uso: asignar-tienda CORREO TIENDA")
	}
	return db.Transaction(func(tx *gorm.DB) error {
		var s shop
		if err := tx.Take(&s, "slug = ?", args[1]).Error; err != nil {
			return err
		}
		if err := createSeller(tx, args[:1]); err != nil {
			return err
		}
		email, _ := sellerEmail(args[0])
		return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&shopMembership{SellerEmail: email, ShopSlug: s.Slug}).Error
	})
}
