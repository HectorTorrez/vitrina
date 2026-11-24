package main

import (
	"bytes"
	"crypto/rand"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestOrdersCouponsDeliveryPaymentsAndStock(t *testing.T) {
	db := testDB(t)
	suffix := strings.ToLower(rand.Text())
	owner := "owner-ord-" + suffix + "@example.com"
	shopSlug := "ord-" + suffix
	if err := ensureSeller(db, owner); err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&shop{Slug: shopSlug, Name: "Tienda Pedidos", Theme: "costa", Timezone: "America/El_Salvador"}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&shopMembership{SellerEmail: owner, ShopSlug: shopSlug}).Error; err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		db.Where("shop_slug = ?", shopSlug).Delete(&shopOrder{})
		db.Where("shop_slug = ?", shopSlug).Delete(&shopCoupon{})
		db.Where("shop_slug = ?", shopSlug).Delete(&product{})
		db.Where("slug = ?", shopSlug).Delete(&shop{})
		db.Where("email = ?", owner).Delete(&seller{})
	})

	token := sessionPrefix + rand.Text()
	if err := db.Create(&sellerSession{
		TokenHash: tokenHash(token), SellerEmail: owner, ExpiresAt: time.Now().Add(time.Hour),
	}).Error; err != nil {
		t.Fatal(err)
	}

	mux := http.NewServeMux()
	panelRoutes(mux, db)
	orderRoutes(mux, db)
	catalogRoutes(mux, db)

	panelReq := func(input *panelInput, want int) *httptest.ResponseRecorder {
		t.Helper()
		method := http.MethodGet
		var body []byte
		if input != nil {
			method = http.MethodPost
			var err error
			body, err = json.Marshal(input)
			if err != nil {
				t.Fatal(err)
			}
		}
		r := httptest.NewRequest(method, "/api/panel", bytes.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		r.AddCookie(&http.Cookie{Name: sessionCookie, Value: token})
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		if w.Code != want {
			t.Fatalf("%s /api/panel: got %d, want %d: %s", method, w.Code, want, w.Body.String())
		}
		return w
	}

	publicPost := func(path string, payload any, want int) *httptest.ResponseRecorder {
		t.Helper()
		body, err := json.Marshal(payload)
		if err != nil {
			t.Fatal(err)
		}
		r := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		if w.Code != want {
			t.Fatalf("POST %s: got %d, want %d: %s", path, w.Code, want, w.Body.String())
		}
		return w
	}

	// 1. Configure delivery options and custom + preset payment methods
	panelReq(&panelInput{
		Action:   "editar-tienda",
		ShopSlug: shopSlug,
		Profile: shop{
			Name:  "Tienda Pedidos",
			Theme: "costa",
			Delivery: deliveryConfig{
				PickupEnabled:    true,
				PickupNote:       "Col. Escalón",
				DeliveryEnabled:  true,
				DeliveryFeeMode:  "fixed",
				DeliveryFeeCents: 350,
				DeliveryNote:     "San Salvador",
			},
			PaymentMethods: []string{"cash", "transfer", "Chivo Wallet", "cash"},
		},
	}, http.StatusNoContent)

	var loaded panelAccess
	if err := json.Unmarshal(panelReq(nil, http.StatusOK).Body.Bytes(), &loaded); err != nil {
		t.Fatal(err)
	}
	if len(loaded.Shops) != 1 {
		t.Fatalf("expected 1 shop, got %d", len(loaded.Shops))
	}
	s := loaded.Shops[0]
	if !s.Delivery.PickupEnabled || !s.Delivery.DeliveryEnabled || s.Delivery.DeliveryFeeCents != 350 {
		t.Fatalf("delivery config not saved: %+v", s.Delivery)
	}
	if len(s.PaymentMethods) != 3 || s.PaymentMethods[2] != "Chivo Wallet" {
		t.Fatalf("unexpected payment methods: %+v", s.PaymentMethods)
	}

	// 2. Create a product with tracked stock = 2 and option surcharge
	stockTwo := 2
	panelReq(&panelInput{
		Action:   "crear-item",
		ShopSlug: shopSlug,
		Item: product{
			Slug:       "taza",
			Name:       "Taza cerámica",
			Kind:       "product",
			PriceCents: 1500,
			Available:  true,
			Stock:      &stockTwo,
			Options:    []option{{Name: "Tamaño", Values: []string{"Normal", "Grande"}, Prices: []int{0, 300}}},
		},
	}, http.StatusNoContent)

	// 3. Create coupons: active percent coupon IG10 and expired coupon OLD20
	panelReq(&panelInput{
		Action:   "crear-cupon",
		ShopSlug: shopSlug,
		Coupon:   shopCoupon{Code: "ig10", Kind: "percent", Value: 10, MinOrderCents: 1000, Active: true},
	}, http.StatusNoContent)
	panelReq(&panelInput{
		Action:   "crear-cupon",
		ShopSlug: shopSlug,
		Coupon:   shopCoupon{Code: "OLD20", Kind: "fixed", Value: 500, ExpiresDate: "2020-01-01", Active: true},
	}, http.StatusNoContent)

	// Validate coupons
	res := publicPost("/api/shops/"+shopSlug+"/coupons/validate", map[string]any{"code": "IG10", "subtotalCents": 3600}, http.StatusOK)
	var couponRes struct {
		Code          string `json:"code"`
		DiscountCents int    `json:"discountCents"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &couponRes); err != nil {
		t.Fatal(err)
	}
	if couponRes.Code != "IG10" || couponRes.DiscountCents != 360 {
		t.Fatalf("unexpected coupon validation: %+v", couponRes)
	}
	// Expired coupon fails
	publicPost("/api/shops/"+shopSlug+"/coupons/validate", map[string]any{"code": "OLD20", "subtotalCents": 3600}, http.StatusBadRequest)
	// Below min order fails
	publicPost("/api/shops/"+shopSlug+"/coupons/validate", map[string]any{"code": "IG10", "subtotalCents": 500}, http.StatusBadRequest)

	// 4. Create an order exceeding stock -> 400
	publicPost("/api/shops/"+shopSlug+"/orders", map[string]any{
		"items": []map[string]any{{"slug": "taza", "quantity": 3}},
	}, http.StatusBadRequest)

	// Reject disallowed payment method -> 400
	publicPost("/api/shops/"+shopSlug+"/orders", map[string]any{
		"paymentMethod": "card",
		"items":         []map[string]any{{"slug": "taza", "quantity": 1}},
	}, http.StatusBadRequest)

	// 5. Create valid order for 2x Taza Grande ($18 each = $36), IG10 (-$3.60), delivery (+$3.50) = $35.90 (3590 cents)
	orderRes := publicPost("/api/shops/"+shopSlug+"/orders", map[string]any{
		"customerName":    "Ana",
		"customerPhone":   "+50370001111",
		"deliveryMethod":  "delivery",
		"deliveryAddress": "Col. San Benito #12",
		"paymentMethod":   "Chivo Wallet",
		"couponCode":      "IG10",
		"notes":           "Envolver para regalo",
		"items": []map[string]any{
			{"slug": "taza", "quantity": 2, "choices": map[string]string{"Tamaño": "Grande"}},
		},
	}, http.StatusCreated)
	var created struct {
		ID               uint   `json:"id"`
		Code             string `json:"code"`
		SubtotalCents    int    `json:"subtotalCents"`
		DiscountCents    int    `json:"discountCents"`
		DeliveryFeeCents int    `json:"deliveryFeeCents"`
		TotalCents       int    `json:"totalCents"`
	}
	if err := json.Unmarshal(orderRes.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if created.Code != "#1001" || created.SubtotalCents != 3600 || created.DiscountCents != 360 || created.DeliveryFeeCents != 350 || created.TotalCents != 3590 {
		t.Fatalf("unexpected created order: %+v", created)
	}

	// 6. Confirm order -> stock drops from 2 to 0 and available becomes false
	panelReq(&panelInput{
		Action:      "estado-pedido",
		ShopSlug:    shopSlug,
		OrderID:     created.ID,
		OrderStatus: "confirmed",
	}, http.StatusNoContent)

	var afterConfirm product
	if err := db.Take(&afterConfirm, "shop_slug = ? AND slug = ?", shopSlug, "taza").Error; err != nil {
		t.Fatal(err)
	}
	if afterConfirm.Stock == nil || *afterConfirm.Stock != 0 || afterConfirm.Available {
		t.Fatalf("expected stock=0 available=false after confirm, got stock=%v available=%v", afterConfirm.Stock, afterConfirm.Available)
	}

	// 7. Cancel order -> stock restores to 2 and available becomes true
	panelReq(&panelInput{
		Action:      "estado-pedido",
		ShopSlug:    shopSlug,
		OrderID:     created.ID,
		OrderStatus: "cancelled",
	}, http.StatusNoContent)

	var afterCancel product
	if err := db.Take(&afterCancel, "shop_slug = ? AND slug = ?", shopSlug, "taza").Error; err != nil {
		t.Fatal(err)
	}
	if afterCancel.Stock == nil || *afterCancel.Stock != 2 || !afterCancel.Available {
		t.Fatalf("expected stock=2 available=true after cancel, got stock=%v available=%v", afterCancel.Stock, afterCancel.Available)
	}

	// 8. Clear stock tracking (set Stock = nil) via editar-item
	panelReq(&panelInput{
		Action:   "editar-item",
		ShopSlug: shopSlug,
		Item: product{
			Slug:       "taza",
			Name:       "Taza cerámica",
			Kind:       "product",
			PriceCents: 1500,
			Available:  true,
			Stock:      nil,
		},
	}, http.StatusNoContent)
	var afterClear product
	if err := db.Take(&afterClear, "shop_slug = ? AND slug = ?", shopSlug, "taza").Error; err != nil {
		t.Fatal(err)
	}
	if afterClear.Stock != nil {
		t.Fatalf("expected stock=nil after disabling tracking, got %v", *afterClear.Stock)
	}
}
