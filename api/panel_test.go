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

func TestPanelShopPermissionsAndManagement(t *testing.T) {
	db := testDB(t)
	suffix := strings.ToLower(rand.Text())
	operator := "operator-" + suffix + "@example.com"
	owner := "owner-" + suffix + "@example.com"
	other := "other-" + suffix + "@example.com"
	first, second := "shop-"+suffix, "other-"+suffix
	if err := grantOperator(db, operator); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		db.Where("shop_slug IN ?", []string{first, second}).Delete(&reservation{})
		db.Where("shop_slug IN ?", []string{first, second}).Delete(&product{})
		db.Where("slug IN ?", []string{first, second}).Delete(&shop{})
		db.Where("email IN ?", []string{operator, owner, other}).Delete(&seller{})
	})
	login := func(email string) string {
		t.Helper()
		token := sessionPrefix + rand.Text()
		if err := db.Create(&sellerSession{
			TokenHash: tokenHash(token), SellerEmail: email, ExpiresAt: time.Now().Add(time.Hour),
		}).Error; err != nil {
			t.Fatal(err)
		}
		return token
	}
	mux := http.NewServeMux()
	panelRoutes(mux, db)
	request := func(token string, input *panelInput, want int) *httptest.ResponseRecorder {
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
		if token != "" {
			r.AddCookie(&http.Cookie{Name: sessionCookie, Value: token})
		}
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		if w.Code != want {
			t.Fatalf("%s: got %d, want %d: %s", method, w.Code, want, w.Body.String())
		}
		return w
	}
	load := func(token string) panelAccess {
		t.Helper()
		response := request(token, nil, 200)
		var panel panelAccess
		if err := json.Unmarshal(response.Body.Bytes(), &panel); err != nil {
			t.Fatal(err)
		}
		return panel
	}

	request("", nil, 401)
	operatorToken := login(operator)
	create := panelInput{Action: "crear-tienda", ShopSlug: first, Email: owner, Profile: shop{Name: "Tienda Uno", Theme: "arena"}}
	request(operatorToken, &create, 204)
	request(operatorToken, &create, 409)
	ownerToken := login(owner)
	create.ShopSlug, create.Email = second, other
	request(ownerToken, &create, 403)
	request(operatorToken, &create, 204)

	edit := panelInput{Action: "editar-tienda", ShopSlug: first, Profile: shop{Name: "Tienda Nueva", Theme: "noche", Whatsapp: "+50370000000"}}
	request(login(other), &edit, 403)
	request(ownerToken, &edit, 204)
	p := load(ownerToken)
	if p.Operator || len(p.Shops) != 1 || p.Shops[0].Slug != first || p.Shops[0].Name != "Tienda Nueva" || p.Shops[0].Whatsapp != "50370000000" {
		t.Fatalf("unexpected panel: %+v", p)
	}

	item := product{Slug: "gel", Name: "Uñas en gel", Kind: "service", DurationMinutes: 45, Available: true,
		PriceCents: 2400, Position: 2, ImageURL: "https://example.com/image.png",
		Options: []option{{Name: "Color", Values: []string{"Marfil", "Verde"}, Prices: []int{0, 300}}}}
	itemInput := panelInput{Action: "crear-item", ShopSlug: first, Item: item}
	request(ownerToken, &itemInput, 204)
	itemInput.Action = "editar-item"
	itemInput.Item.PriceCents, itemInput.Item.Hidden = 0, true
	request(ownerToken, &itemInput, 204)
	items := load(ownerToken).Shops[0].Products
	if len(items) != 1 || !items[0].Hidden || items[0].PriceCents != 0 || len(items[0].Options) != 1 || items[0].Options[0].Values[1] != "Verde" || items[0].Options[0].Prices[1] != 300 {
		t.Fatalf("unexpected catalog: %+v", items)
	}

	start := time.Now().In(shopZone).Add(24 * time.Hour).Truncate(time.Minute)
	format := localMinute
	bookInput := panelInput{Action: "agendar", ShopSlug: first, Booking: panelBooking{ServiceSlug: item.Slug, Customer: "Ada", StartsAt: start.Format(format)}}
	request(ownerToken, &bookInput, 404)
	itemInput.Item.Hidden = false
	request(ownerToken, &itemInput, 204)
	request(ownerToken, &bookInput, 204)
	request(ownerToken, &bookInput, 409)
	bookings := load(ownerToken).Shops[0].Bookings
	if len(bookings) != 1 || bookings[0].EndsAt != start.Add(45*time.Minute).Format(format) || !bookings[0].Editable {
		t.Fatalf("unexpected bookings: %+v", bookings)
	}
	id := bookings[0].ID
	shift := bookInput
	shift.Action, shift.Booking.ID = "reprogramar", id
	shift.Booking.StartsAt = start.Add(15 * time.Minute).Format(format)
	request(ownerToken, &shift, 204)
	cancel := panelInput{Action: "cancelar", ShopSlug: first, Booking: panelBooking{ID: id}}
	request(ownerToken, &cancel, 204)
	request(ownerToken, &shift, 404)
	request(ownerToken, &bookInput, 204)
	bookings = load(ownerToken).Shops[0].Bookings
	if len(bookings) != 2 || !bookings[1].Cancelled || bookings[1].Editable || bookings[1].StartsAt != shift.Booking.StartsAt {
		t.Fatalf("unexpected bookings after cancellation: %+v", bookings)
	}

	remove := panelInput{Action: "eliminar-item", ShopSlug: first, Item: product{Slug: item.Slug}}
	request(ownerToken, &remove, 400)
	extra := panelInput{Action: "crear-item", ShopSlug: first, Item: product{Slug: "lamina", Name: "Lámina", Kind: "product", Available: true}}
	request(ownerToken, &extra, 204)
	remove.Item.Slug = "lamina"
	request(login(other), &remove, 403)
	request(ownerToken, &remove, 204)
	request(ownerToken, &remove, 404)
	if items := load(ownerToken).Shops[0].Products; len(items) != 1 {
		t.Fatalf("unexpected catalog after delete: %+v", items)
	}
}
