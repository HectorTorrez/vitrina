package main

import (
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type orderItem struct {
	Slug           string            `json:"slug"`
	Name           string            `json:"name"`
	Quantity       int               `json:"quantity"`
	UnitPriceCents int               `json:"unitPriceCents"`
	Choices        map[string]string `json:"choices,omitempty"`
}

type shopOrder struct {
	ID               uint        `json:"id" gorm:"primaryKey"`
	ShopSlug         string      `json:"-" gorm:"index:idx_shop_orders,priority:1;uniqueIndex:idx_shop_order_code,priority:1;not null"`
	Code             string      `json:"code" gorm:"uniqueIndex:idx_shop_order_code,priority:2;not null"`
	Status           string      `json:"status" gorm:"not null;default:'new'"`
	CustomerName     string      `json:"customerName" gorm:"not null;default:''"`
	CustomerPhone    string      `json:"customerPhone" gorm:"not null;default:''"`
	Items            []orderItem `json:"items" gorm:"serializer:json;type:jsonb;not null;default:'[]'"`
	SubtotalCents    int         `json:"subtotalCents" gorm:"not null;default:0"`
	DeliveryMethod   string      `json:"deliveryMethod" gorm:"not null;default:''"`
	DeliveryFeeCents int         `json:"deliveryFeeCents" gorm:"not null;default:0"`
	DeliveryAddress  string      `json:"deliveryAddress" gorm:"not null;default:''"`
	PaymentMethod    string      `json:"paymentMethod" gorm:"not null;default:''"`
	CouponCode       string      `json:"couponCode" gorm:"not null;default:''"`
	DiscountCents    int         `json:"discountCents" gorm:"not null;default:0"`
	TotalCents       int         `json:"totalCents" gorm:"not null;default:0"`
	Notes            string      `json:"notes" gorm:"not null;default:''"`
	StockDeducted    bool        `json:"stockDeducted" gorm:"not null;default:false"`
	CreatedAt        time.Time   `json:"createdAt" gorm:"index:idx_shop_orders,priority:2"`
}

func (o *shopOrder) AfterFind(*gorm.DB) error {
	if o.Items == nil {
		o.Items = []orderItem{}
	}
	return nil
}

type panelOrder struct {
	shopOrder
	LocalCreatedAt string `json:"localCreatedAt"`
	LocalMonth     string `json:"localMonth"`
}

type shopCoupon struct {
	ID            uint      `json:"id" gorm:"primaryKey"`
	ShopSlug      string    `json:"-" gorm:"uniqueIndex:idx_shop_coupon_code,priority:1;not null"`
	Code          string    `json:"code" gorm:"uniqueIndex:idx_shop_coupon_code,priority:2;not null"`
	Kind          string    `json:"kind" gorm:"not null"` // "percent" | "fixed"
	Value         int       `json:"value" gorm:"not null"`
	MinOrderCents int       `json:"minOrderCents" gorm:"not null;default:0"`
	ExpiresDate   string    `json:"expiresDate" gorm:"not null;default:''"` // YYYY-MM-DD or ""
	Active        bool      `json:"active" gorm:"not null;default:true"`
	Uses          int       `json:"uses" gorm:"not null;default:0"`
	CreatedAt     time.Time `json:"createdAt"`
}

var (
	couponCodePattern  = regexp.MustCompile(`^[A-Z0-9_-]{2,24}$`)
	validDeliveryModes = []string{"", "free", "fixed", "coordinate"}
	validOrderStatuses = []string{"new", "confirmed", "delivered", "cancelled"}
)

const (
	maxPaymentMethods = 12
	maxOrdersPerHour  = 60
	maxOrderItems     = 50
)

func validatedDelivery(input deliveryConfig) (deliveryConfig, error) {
	cfg := deliveryConfig{
		PickupEnabled:    input.PickupEnabled,
		PickupNote:       strings.TrimSpace(input.PickupNote),
		DeliveryEnabled:  input.DeliveryEnabled,
		DeliveryFeeMode:  strings.TrimSpace(input.DeliveryFeeMode),
		DeliveryFeeCents: input.DeliveryFeeCents,
		DeliveryNote:     strings.TrimSpace(input.DeliveryNote),
	}
	if utf8.RuneCountInString(cfg.PickupNote) > 160 || utf8.RuneCountInString(cfg.DeliveryNote) > 160 {
		return deliveryConfig{}, validationError("Las notas de entrega pueden tener hasta 160 caracteres")
	}
	if !slices.Contains(validDeliveryModes, cfg.DeliveryFeeMode) {
		return deliveryConfig{}, validationError("Elegí una modalidad válida para el costo de envío")
	}
	if cfg.DeliveryEnabled && cfg.DeliveryFeeMode == "" {
		cfg.DeliveryFeeMode = "coordinate"
	}
	if cfg.DeliveryFeeMode == "fixed" {
		if cfg.DeliveryFeeCents < 0 || cfg.DeliveryFeeCents > 99999999 {
			return deliveryConfig{}, validationError("Indicá una tarifa de envío válida")
		}
	} else {
		cfg.DeliveryFeeCents = 0
	}
	return cfg, nil
}

func validatedPaymentMethods(methods []string) ([]string, error) {
	if len(methods) > maxPaymentMethods {
		return nil, validationError("Podés configurar hasta 12 métodos de pago")
	}
	seen := make(map[string]bool, len(methods))
	result := make([]string, 0, len(methods))
	for _, raw := range methods {
		m := strings.TrimSpace(raw)
		if m == "" {
			continue
		}
		if utf8.RuneCountInString(m) > 40 {
			return nil, validationError("Cada método de pago puede tener hasta 40 caracteres")
		}
		key := strings.ToLower(m)
		if seen[key] {
			continue
		}
		seen[key] = true
		result = append(result, m)
	}
	return result, nil
}

func computeCouponDiscount(c shopCoupon, subtotalCents int, today string) (int, error) {
	if !c.Active {
		return 0, validationError("Este cupón no está activo")
	}
	if c.ExpiresDate != "" && today > c.ExpiresDate {
		return 0, validationError("Este cupón ya venció")
	}
	if c.MinOrderCents > 0 && subtotalCents < c.MinOrderCents {
		return 0, validationError("El subtotal no alcanza el mínimo para este cupón")
	}
	var discount int
	switch c.Kind {
	case "percent":
		discount = (subtotalCents * c.Value) / 100
	case "fixed":
		discount = c.Value
	default:
		return 0, validationError("Cupón inválido")
	}
	if discount > subtotalCents {
		discount = subtotalCents
	}
	if discount < 0 {
		discount = 0
	}
	return discount, nil
}

func orderRoutes(mux *http.ServeMux, db *gorm.DB) {
	mux.HandleFunc("POST /api/shops/{slug}/coupons/validate", func(w http.ResponseWriter, r *http.Request) {
		slug := r.PathValue("slug")
		if !validSlug(slug) {
			writeError(w, gorm.ErrRecordNotFound)
			return
		}
		var req struct {
			Code          string `json:"code"`
			SubtotalCents int    `json:"subtotalCents"`
		}
		if !readJSON(w, r, &req, 4*1024) {
			return
		}
		code := strings.ToUpper(strings.TrimSpace(req.Code))
		if !couponCodePattern.MatchString(code) {
			writeError(w, validationError("Cupón inválido"))
			return
		}
		if req.SubtotalCents < 0 {
			writeError(w, validationError("Subtotal inválido"))
			return
		}
		q := db.WithContext(r.Context())
		var s shop
		if err := q.Take(&s, "slug = ?", slug).Error; err != nil {
			writeError(w, err)
			return
		}
		var c shopCoupon
		err := q.Take(&c, "shop_slug = ? AND code = ?", slug, code).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeError(w, validationError("Cupón no encontrado"))
			return
		}
		if err != nil {
			writeError(w, err)
			return
		}
		today := time.Now().In(s.location()).Format(localDate)
		discount, err := computeCouponDiscount(c, req.SubtotalCents, today)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"code":          c.Code,
			"kind":          c.Kind,
			"value":         c.Value,
			"discountCents": discount,
			"minOrderCents": c.MinOrderCents,
		})
	})

	mux.HandleFunc("POST /api/shops/{slug}/orders", func(w http.ResponseWriter, r *http.Request) {
		slug := r.PathValue("slug")
		if !validSlug(slug) {
			writeError(w, gorm.ErrRecordNotFound)
			return
		}
		var req struct {
			CustomerName    string `json:"customerName"`
			CustomerPhone   string `json:"customerPhone"`
			DeliveryMethod  string `json:"deliveryMethod"`
			DeliveryAddress string `json:"deliveryAddress"`
			PaymentMethod   string `json:"paymentMethod"`
			CouponCode      string `json:"couponCode"`
			Notes           string `json:"notes"`
			Items           []struct {
				Slug     string            `json:"slug"`
				Quantity int               `json:"quantity"`
				Choices  map[string]string `json:"choices"`
			} `json:"items"`
		}
		if !readJSON(w, r, &req, 32*1024) {
			return
		}
		if len(req.Items) == 0 || len(req.Items) > maxOrderItems {
			writeError(w, validationError("Agregá al menos un producto al pedido"))
			return
		}
		customerName := strings.TrimSpace(req.CustomerName)
		if utf8.RuneCountInString(customerName) > 80 {
			writeError(w, validationError("El nombre puede tener hasta 80 caracteres"))
			return
		}
		customerPhone := strings.TrimSpace(req.CustomerPhone)
		if utf8.RuneCountInString(customerPhone) > 30 {
			writeError(w, validationError("El teléfono es demasiado largo"))
			return
		}
		deliveryAddress := strings.TrimSpace(req.DeliveryAddress)
		if utf8.RuneCountInString(deliveryAddress) > 240 {
			writeError(w, validationError("La dirección puede tener hasta 240 caracteres"))
			return
		}
		notes := strings.TrimSpace(req.Notes)
		if utf8.RuneCountInString(notes) > 400 {
			writeError(w, validationError("Las notas pueden tener hasta 400 caracteres"))
			return
		}

		var created shopOrder
		err := db.WithContext(r.Context()).Transaction(func(tx *gorm.DB) error {
			var s shop
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Take(&s, "slug = ?", slug).Error; err != nil {
				return err
			}
			var recent int64
			if err := tx.Model(&shopOrder{}).
				Where("shop_slug = ? AND created_at > ?", slug, time.Now().Add(-time.Hour)).
				Count(&recent).Error; err != nil {
				return err
			}
			if recent >= maxOrdersPerHour {
				return validationError("Esta tienda alcanzó el límite temporal de pedidos. Intentá más tarde.")
			}

			var products []product
			if err := tx.Where("shop_slug = ? AND hidden = ?", slug, false).Find(&products).Error; err != nil {
				return err
			}
			bySlug := make(map[string]product, len(products))
			for _, p := range products {
				bySlug[p.Slug] = p
			}

			qtyBySlug := make(map[string]int)
			items := make([]orderItem, 0, len(req.Items))
			subtotal := 0
			for _, line := range req.Items {
				if line.Quantity < 1 || line.Quantity > 99 {
					return validationError("Revisá la cantidad de cada producto")
				}
				p, ok := bySlug[line.Slug]
				if !ok || !p.Available {
					return validationError("Uno de los productos del carrito ya no está disponible")
				}
				if p.Stock != nil && *p.Stock <= 0 {
					return validationError(fmt.Sprintf("%s está agotado", p.Name))
				}
				qtyBySlug[p.Slug] += line.Quantity
				if p.Stock != nil && qtyBySlug[p.Slug] > *p.Stock {
					return validationError(fmt.Sprintf("Solo quedan %d unidades de %s", *p.Stock, p.Name))
				}
				unitPrice := p.PriceCents
				cleanChoices := make(map[string]string, len(p.Options))
				for _, opt := range p.Options {
					chosen := strings.TrimSpace(line.Choices[opt.Name])
					idx := slices.Index(opt.Values, chosen)
					if idx < 0 {
						idx = 0
					}
					if len(opt.Values) > 0 {
						cleanChoices[opt.Name] = opt.Values[idx]
					}
					if idx < len(opt.Prices) {
						unitPrice += opt.Prices[idx]
					}
				}
				subtotal += unitPrice * line.Quantity
				items = append(items, orderItem{
					Slug:           p.Slug,
					Name:           p.Name,
					Quantity:       line.Quantity,
					UnitPriceCents: unitPrice,
					Choices:        cleanChoices,
				})
			}

			deliveryMethod := strings.TrimSpace(req.DeliveryMethod)
			deliveryFee := 0
			switch deliveryMethod {
			case "":
				// Optional if shop hasn't configured delivery options
			case "pickup":
				if !s.Delivery.PickupEnabled {
					return validationError("Esta tienda no ofrece retiro en local")
				}
				deliveryAddress = ""
			case "delivery":
				if !s.Delivery.DeliveryEnabled {
					return validationError("Esta tienda no ofrece envío a domicilio")
				}
				if s.Delivery.DeliveryFeeMode == "fixed" {
					deliveryFee = s.Delivery.DeliveryFeeCents
				}
			default:
				return validationError("Método de entrega inválido")
			}

			paymentMethod := strings.TrimSpace(req.PaymentMethod)
			if paymentMethod != "" {
				if len(s.PaymentMethods) > 0 && !slices.Contains(s.PaymentMethods, paymentMethod) {
					return validationError("Método de pago no habilitado en esta tienda")
				}
				if utf8.RuneCountInString(paymentMethod) > 40 {
					return validationError("Método de pago inválido")
				}
			}

			couponCode := strings.ToUpper(strings.TrimSpace(req.CouponCode))
			discount := 0
			if couponCode != "" {
				var c shopCoupon
				err := tx.Take(&c, "shop_slug = ? AND code = ?", slug, couponCode).Error
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return validationError("Cupón no encontrado")
				}
				if err != nil {
					return err
				}
				today := time.Now().In(s.location()).Format(localDate)
				discount, err = computeCouponDiscount(c, subtotal, today)
				if err != nil {
					return err
				}
				if err := tx.Model(&shopCoupon{}).Where("id = ?", c.ID).
					Update("uses", gorm.Expr("uses + 1")).Error; err != nil {
					return err
				}
			}

			total := subtotal - discount + deliveryFee
			if total < 0 {
				total = 0
			}

			var existingCount int64
			if err := tx.Model(&shopOrder{}).Where("shop_slug = ?", slug).Count(&existingCount).Error; err != nil {
				return err
			}
			seq := 1001 + existingCount
			var code string
			for range 20 {
				candidate := fmt.Sprintf("#%d", seq)
				var clash int64
				if err := tx.Model(&shopOrder{}).Where("shop_slug = ? AND code = ?", slug, candidate).Count(&clash).Error; err != nil {
					return err
				}
				if clash == 0 {
					code = candidate
					break
				}
				seq++
			}
			if code == "" {
				code = fmt.Sprintf("#%d", time.Now().Unix()%100000)
			}

			created = shopOrder{
				ShopSlug:         slug,
				Code:             code,
				Status:           "new",
				CustomerName:     customerName,
				CustomerPhone:    customerPhone,
				Items:            items,
				SubtotalCents:    subtotal,
				DeliveryMethod:   deliveryMethod,
				DeliveryFeeCents: deliveryFee,
				DeliveryAddress:  deliveryAddress,
				PaymentMethod:    paymentMethod,
				CouponCode:       couponCode,
				DiscountCents:    discount,
				TotalCents:       total,
				Notes:            notes,
			}
			return tx.Create(&created).Error
		})
		if err != nil {
			writeError(w, err)
			return
		}
		liveHub.publish(slug, "orders", "shop")
		writeJSON(w, http.StatusCreated, map[string]any{
			"id":               created.ID,
			"code":             created.Code,
			"subtotalCents":    created.SubtotalCents,
			"discountCents":    created.DiscountCents,
			"deliveryFeeCents": created.DeliveryFeeCents,
			"totalCents":       created.TotalCents,
		})
	})
}

func loadPanelOrders(db *gorm.DB, email string, zones map[string]*time.Location) (map[string][]panelOrder, error) {
	var rows []shopOrder
	err := db.Where("shop_slug IN (?)", db.Model(&shopMembership{}).Select("shop_slug").Where("seller_email = ?", email)).
		Order("created_at DESC, id DESC").Limit(500).Find(&rows).Error
	if err != nil {
		return nil, err
	}
	byShop := make(map[string][]panelOrder)
	for _, row := range rows {
		loc := zones[row.ShopSlug]
		if loc == nil {
			loc = shopZone
		}
		local := row.CreatedAt.In(loc)
		byShop[row.ShopSlug] = append(byShop[row.ShopSlug], panelOrder{
			shopOrder:      row,
			LocalCreatedAt: local.Format(localMinute),
			LocalMonth:     local.Format("2006-01"),
		})
	}
	return byShop, nil
}

func loadPanelCoupons(db *gorm.DB, email string) (map[string][]shopCoupon, error) {
	var rows []shopCoupon
	err := db.Where("shop_slug IN (?)", db.Model(&shopMembership{}).Select("shop_slug").Where("seller_email = ?", email)).
		Order("created_at DESC, id DESC").Find(&rows).Error
	if err != nil {
		return nil, err
	}
	byShop := make(map[string][]shopCoupon)
	for _, row := range rows {
		byShop[row.ShopSlug] = append(byShop[row.ShopSlug], row)
	}
	return byShop, nil
}

func updateOrderStatus(db *gorm.DB, shopSlug string, orderID uint, status string) error {
	if orderID == 0 || !slices.Contains(validOrderStatuses, status) {
		return validationError("Estado de pedido inválido")
	}
	return db.Transaction(func(tx *gorm.DB) error {
		var order shopOrder
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Take(&order, "id = ? AND shop_slug = ?", orderID, shopSlug).Error; err != nil {
			return err
		}
		shouldDeduct := (status == "confirmed" || status == "delivered") && !order.StockDeducted
		shouldRestore := status == "cancelled" && order.StockDeducted

		if shouldDeduct || shouldRestore {
			for _, item := range order.Items {
				var p product
				err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
					Take(&p, "shop_slug = ? AND slug = ?", shopSlug, item.Slug).Error
				if errors.Is(err, gorm.ErrRecordNotFound) {
					continue
				}
				if err != nil {
					return err
				}
				if p.Stock == nil {
					continue
				}
				current := *p.Stock
				if shouldDeduct {
					next := current - item.Quantity
					if next < 0 {
						next = 0
					}
					updates := map[string]any{"stock": next}
					if next == 0 {
						updates["available"] = false
					}
					if err := tx.Model(&product{}).Where("shop_slug = ? AND slug = ?", shopSlug, p.Slug).
						Updates(updates).Error; err != nil {
						return err
					}
				} else if shouldRestore {
					next := current + item.Quantity
					if next > 999999 {
						next = 999999
					}
					updates := map[string]any{"stock": next}
					if current == 0 && next > 0 {
						updates["available"] = true
					}
					if err := tx.Model(&product{}).Where("shop_slug = ? AND slug = ?", shopSlug, p.Slug).
						Updates(updates).Error; err != nil {
						return err
					}
				}
			}
		}

		nextDeducted := order.StockDeducted
		if shouldDeduct {
			nextDeducted = true
		} else if shouldRestore {
			nextDeducted = false
		}
		return tx.Model(&shopOrder{}).Where("id = ? AND shop_slug = ?", orderID, shopSlug).
			Updates(map[string]any{"status": status, "stock_deducted": nextDeducted}).Error
	})
}

func validateCouponInput(c *shopCoupon) error {
	c.Code = strings.ToUpper(strings.TrimSpace(c.Code))
	c.Kind = strings.TrimSpace(c.Kind)
	c.ExpiresDate = strings.TrimSpace(c.ExpiresDate)
	if !couponCodePattern.MatchString(c.Code) {
		return validationError("Usá de 2 a 24 letras, números o guiones para el código del cupón")
	}
	switch c.Kind {
	case "percent":
		if c.Value < 1 || c.Value > 100 {
			return validationError("El porcentaje de descuento debe estar entre 1 y 100")
		}
	case "fixed":
		if c.Value < 1 || c.Value > 99999999 {
			return validationError("Indicá un monto fijo de descuento válido")
		}
	default:
		return validationError("Elegí descuento porcentual o monto fijo")
	}
	if c.MinOrderCents < 0 || c.MinOrderCents > 99999999 {
		return validationError("Revisá el monto mínimo del pedido")
	}
	if c.ExpiresDate != "" {
		if _, err := time.Parse(localDate, c.ExpiresDate); err != nil {
			return validationError("Usá una fecha de vencimiento válida (YYYY-MM-DD)")
		}
	}
	return nil
}

func savePanelCoupon(db *gorm.DB, shopSlug string, input shopCoupon, create bool) error {
	input.ShopSlug = shopSlug
	if err := validateCouponInput(&input); err != nil {
		return err
	}
	if create {
		input.ID = 0
		input.Uses = 0
		result := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&input)
		if result.Error == nil && result.RowsAffected == 0 {
			return errConflict
		}
		return result.Error
	}
	if input.ID == 0 {
		return validationError("Indicá el cupón a editar")
	}
	result := db.Model(&shopCoupon{}).Where("id = ? AND shop_slug = ?", input.ID, shopSlug).
		Select("kind", "value", "min_order_cents", "expires_date", "active").Updates(&input)
	if result.Error == nil && result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return result.Error
}

func deletePanelCoupon(db *gorm.DB, shopSlug string, id uint) error {
	if id == 0 {
		return validationError("Indicá un cupón válido")
	}
	result := db.Where("id = ? AND shop_slug = ?", id, shopSlug).Delete(&shopCoupon{})
	if result.Error == nil && result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return result.Error
}
