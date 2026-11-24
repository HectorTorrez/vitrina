package main

import (
	"errors"
	"net/http"
	"net/url"
	"regexp"
	"slices"
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
	shop
	Bookings  []panelBooking `json:"bookings"`
	Orders    []panelOrder   `json:"orders"`
	Coupons   []shopCoupon   `json:"coupons"`
	Analytics shopAnalytics  `json:"analytics"`
}

type panelAccess struct {
	Email    string      `json:"email"`
	Operator bool        `json:"operator"`
	Shops    []panelShop `json:"shops"`
}

type panelInput struct {
	Booking     panelBooking
	Item        product
	Order       []string
	OrderID     uint
	OrderStatus string
	Coupon      shopCoupon
	Action      string
	ShopSlug    string
	Email       string
	Profile     shop
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
	zones := make(map[string]*time.Location, len(shops))
	for _, s := range shops {
		zones[s.Slug] = s.location()
	}
	bookings, err := loadPanelBookings(db, account.Email, zones)
	if err != nil {
		return result, err
	}
	orders, err := loadPanelOrders(db, account.Email, zones)
	if err != nil {
		return result, err
	}
	coupons, err := loadPanelCoupons(db, account.Email)
	if err != nil {
		return result, err
	}
	analytics := loadPanelAnalytics(db, account.Email)
	for _, s := range shops {
		shopBookings := bookings[s.Slug]
		if shopBookings == nil {
			shopBookings = []panelBooking{}
		}
		shopOrders := orders[s.Slug]
		if shopOrders == nil {
			shopOrders = []panelOrder{}
		}
		shopCoupons := coupons[s.Slug]
		if shopCoupons == nil {
			shopCoupons = []shopCoupon{}
		}
		stat := analytics[s.Slug]
		if stat.TopItems == nil {
			stat.TopItems = []topItemStat{}
		}
		result.Shops = append(result.Shops, panelShop{
			shop:      s,
			Bookings:  shopBookings,
			Orders:    shopOrders,
			Coupons:   shopCoupons,
			Analytics: stat,
		})
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
			Select("name", "description", "theme", "accent_color", "locale", "timezone", "currency", "blocked_dates", "style", "delivery", "payment_methods", "logo_url", "background_url", "instagram", "tiktok", "facebook", "website", "address", "map_url", "whatsapp", "hours").Updates(&profile).Error
	case "crear-item", "editar-item":
		return savePanelItem(db, input.ShopSlug, input.Item, input.Action == "crear-item")
	case "eliminar-item":
		return deletePanelItem(db, input.ShopSlug, input.Item.Slug)
	case "reordenar-items":
		return reorderPanelItems(db, input.ShopSlug, input.Order)
	case "agendar", "reprogramar", "cancelar":
		return changePanelBooking(db, input)
	case "estado-pedido":
		return updateOrderStatus(db, input.ShopSlug, input.OrderID, input.OrderStatus)
	case "crear-cupon", "editar-cupon":
		return savePanelCoupon(db, input.ShopSlug, input.Coupon, input.Action == "crear-cupon")
	case "eliminar-cupon":
		return deletePanelCoupon(db, input.ShopSlug, input.Coupon.ID)
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

var (
	accentPattern       = regexp.MustCompile(`^#[0-9a-f]{6}$`)
	validStyleFonts     = []string{"", "fraunces", "bricolage", "playfair", "dm-sans", "space-grotesk"}
	validStyleRadii     = []string{"", "sharp", "soft", "pill"}
	validStyleButtons   = []string{"", "solid", "outline", "soft"}
	validStyleHeroes    = []string{"", "left", "center", "compact"}
	validStyleCatalogs  = []string{"", "grid", "list"}
	validStyleAspects   = []string{"", "4/5", "1/1", "4/3"}
	validCurrencies     = []string{"USD", "EUR", "MXN", "GTQ", "HNL", "NIO", "CRC", "COP", "ARS", "PEN", "CLP", "GBP", "CAD"}
)

func validatedStyle(input shopStyle) (shopStyle, error) {
	style := shopStyle{
		Font:          strings.TrimSpace(input.Font),
		BgColor:       strings.ToLower(strings.TrimSpace(input.BgColor)),
		SurfaceColor:  strings.ToLower(strings.TrimSpace(input.SurfaceColor)),
		InkColor:      strings.ToLower(strings.TrimSpace(input.InkColor)),
		Radius:        strings.TrimSpace(input.Radius),
		ButtonStyle:   strings.TrimSpace(input.ButtonStyle),
		HeroLayout:    strings.TrimSpace(input.HeroLayout),
		CatalogLayout: strings.TrimSpace(input.CatalogLayout),
		CardAspect:    strings.TrimSpace(input.CardAspect),
		VeilOpacity:   input.VeilOpacity,
		Announcement:  strings.TrimSpace(input.Announcement),
	}
	if !slices.Contains(validStyleFonts, style.Font) {
		return shopStyle{}, validationError("Elegí una tipografía válida")
	}
	for _, color := range []string{style.BgColor, style.SurfaceColor, style.InkColor} {
		if color != "" && !accentPattern.MatchString(color) {
			return shopStyle{}, validationError("Elegí colores en formato hexadecimal válido")
		}
	}
	if !slices.Contains(validStyleRadii, style.Radius) {
		return shopStyle{}, validationError("Elegí un estilo de bordes válido")
	}
	if !slices.Contains(validStyleButtons, style.ButtonStyle) {
		return shopStyle{}, validationError("Elegí un estilo de botones válido")
	}
	if !slices.Contains(validStyleHeroes, style.HeroLayout) {
		return shopStyle{}, validationError("Elegí un diseño de portada válido")
	}
	if !slices.Contains(validStyleCatalogs, style.CatalogLayout) {
		return shopStyle{}, validationError("Elegí un diseño de catálogo válido")
	}
	if !slices.Contains(validStyleAspects, style.CardAspect) {
		return shopStyle{}, validationError("Elegí una proporción de imagen válida")
	}
	if style.VeilOpacity != 0 && (style.VeilOpacity < 40 || style.VeilOpacity > 95) {
		return shopStyle{}, validationError("La opacidad del fondo debe estar entre 40 y 95")
	}
	if utf8.RuneCountInString(style.Announcement) > 140 {
		return shopStyle{}, validationError("El anuncio puede tener hasta 140 caracteres")
	}
	return style, nil
}

func validatedProfile(input shop) (shop, error) {
	style, err := validatedStyle(input.Style)
	if err != nil {
		return shop{}, err
	}
	delivery, err := validatedDelivery(input.Delivery)
	if err != nil {
		return shop{}, err
	}
	paymentMethods, err := validatedPaymentMethods(input.PaymentMethods)
	if err != nil {
		return shop{}, err
	}
	profile := shop{
		Name:           strings.TrimSpace(input.Name),
		Description:    strings.TrimSpace(input.Description),
		Theme:          input.Theme,
		AccentColor:    strings.ToLower(input.AccentColor),
		Locale:         strings.ToLower(strings.TrimSpace(input.Locale)),
		Timezone:       strings.TrimSpace(input.Timezone),
		Currency:       strings.ToUpper(strings.TrimSpace(input.Currency)),
		Style:          style,
		Delivery:       delivery,
		PaymentMethods: paymentMethods,
		LogoURL:        input.LogoURL,
		BackgroundURL:  input.BackgroundURL,
		Instagram:      strings.TrimPrefix(strings.TrimSpace(input.Instagram), "@"),
		TikTok:         strings.TrimPrefix(strings.TrimSpace(input.TikTok), "@"),
		Facebook:       strings.TrimPrefix(strings.TrimSpace(input.Facebook), "@"),
		Website:        strings.TrimSpace(input.Website),
		Address:        strings.TrimSpace(input.Address),
		MapURL:         strings.TrimSpace(input.MapURL),
	}
	if profile.Timezone == "" {
		profile.Timezone = "America/El_Salvador"
	}
	if _, err := time.LoadLocation(profile.Timezone); err != nil {
		return shop{}, validationError("Elegí una zona horaria válida")
	}
	if profile.Currency == "" {
		profile.Currency = "USD"
	}
	if !slices.Contains(validCurrencies, profile.Currency) {
		return shop{}, validationError("Elegí una moneda válida")
	}
	if len(input.BlockedDates) > 60 {
		return shop{}, validationError("Podés bloquear hasta 60 fechas")
	}
	seenDates := make(map[string]bool)
	blocked := make([]string, 0, len(input.BlockedDates))
	for _, raw := range input.BlockedDates {
		d := strings.TrimSpace(raw)
		if _, err := time.Parse(localDate, d); err != nil {
			return shop{}, validationError("Usá fechas bloqueadas con formato YYYY-MM-DD")
		}
		if !seenDates[d] {
			seenDates[d] = true
			blocked = append(blocked, d)
		}
	}
	slices.Sort(blocked)
	profile.BlockedDates = blocked
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
	if profile.Locale != "" && profile.Locale != "es" && profile.Locale != "en" {
		return shop{}, validationError("Elegí un idioma válido")
	}
	for _, handle := range []string{profile.Instagram, profile.TikTok} {
		if handle != "" && !handlePattern.MatchString(handle) {
			return shop{}, validationError("Ingresá los usuarios de Instagram y TikTok sin la dirección web")
		}
	}
	if profile.Facebook != "" && (utf8.RuneCountInString(profile.Facebook) > 64 || strings.ContainsAny(profile.Facebook, " \t\n/")) {
		return shop{}, validationError("Ingresá solo el nombre de usuario de Facebook")
	}
	if utf8.RuneCountInString(profile.Address) > 200 {
		return shop{}, validationError("La dirección puede tener hasta 200 caracteres")
	}
	for _, raw := range []string{profile.Website, profile.MapURL} {
		if raw == "" {
			continue
		}
		parsed, err := url.Parse(raw)
		if err != nil || len(raw) > 512 || (parsed.Scheme != "https" && parsed.Scheme != "http") || parsed.Hostname() == "" || parsed.User != nil {
			return shop{}, validationError("Ingresá enlaces válidos que empiecen con https://")
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
