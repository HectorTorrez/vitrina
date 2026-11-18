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
	edit.Profile.Theme = "lavanda"
	edit.Profile.AccentColor = "#144D63"
	edit.Profile.LogoURL = "/media/" + suffix + ".png"
	edit.Profile.BackgroundURL = "/media/" + suffix + ".jpg"
	request(login(other), &edit, 403)
	request(ownerToken, &edit, 204)
	p := load(ownerToken)
	if p.Operator || len(p.Shops) != 1 || p.Shops[0].Slug != first || p.Shops[0].Name != "Tienda Nueva" || p.Shops[0].Whatsapp != "50370000000" {
		t.Fatalf("unexpected panel: %+v", p)
	}

	if p.Shops[0].Theme != "lavanda" || p.Shops[0].AccentColor != "#144d63" {
		t.Fatal("shop colors were not saved")
	}
	edit.Profile.AccentColor = "invalid"
	request(ownerToken, &edit, 400)
	edit.Profile.AccentColor = ""
	if p.Shops[0].LogoURL != edit.Profile.LogoURL || p.Shops[0].BackgroundURL != edit.Profile.BackgroundURL {
		t.Fatal("shop images were not saved")
	}
	edit.Profile.BackgroundURL = "invalid"
	request(ownerToken, &edit, 400)
	edit.Profile.LogoURL, edit.Profile.BackgroundURL = "", ""
	request(ownerToken, &edit, 204)
	cleared := load(ownerToken).Shops[0]
	if cleared.AccentColor != "" {
		t.Fatal("shop color was not reset")
	}
	if cleared.LogoURL != "" || cleared.BackgroundURL != "" {
		t.Fatal("shop images were not removed")
	}

	item := product{Slug: "gel", Name: "Uñas en gel", Kind: "service", DurationMinutes: 45, Available: true,
		PriceCents: 2400, Position: 2, ImageURL: "https://example.com/image.png",
		Options: []option{{Name: "Color", Values: []string{"Marfil", "Verde"}, Prices: []int{0, 300}}}}
	itemInput := panelInput{Action: "crear-item", ShopSlug: first, Item: item}
	request(ownerToken, &itemInput, 204)
	itemInput.Action = "editar-item"
	itemInput.Item.PriceCents, itemInput.Item.Hidden = 0, true
	itemInput.Item.Description = "  Esmalte en gel con limado.  "
	itemInput.Item.Gallery = []string{"/media/" + suffix + ".png", "https://example.com/otra.jpg"}
	request(ownerToken, &itemInput, 204)
	items := load(ownerToken).Shops[0].Products
	if items[0].Description != "Esmalte en gel con limado." || len(items[0].Gallery) != 2 || items[0].Gallery[1] != "https://example.com/otra.jpg" {
		t.Fatalf("description or gallery not saved: %+v", items[0])
	}
	bad := itemInput
	bad.Item.Gallery = []string{"http://example.com/x.jpg"}
	request(ownerToken, &bad, 400)
	bad.Item.Gallery = make([]string, 9)
	for i := range bad.Item.Gallery {
		bad.Item.Gallery[i] = "https://example.com/x.jpg"
	}
	request(ownerToken, &bad, 400)
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
