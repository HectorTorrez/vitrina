package main

import (
	"crypto/rand"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestSellerEmailAccess(t *testing.T) {
	db := testDB(t)
	email := "test-" + strings.ToLower(rand.Text()) + "@example.com"
	if err := ensureSeller(db, email); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Delete(&seller{Email: email}) })

	links := make(chan string, 3)
	mux := http.NewServeMux()
	authRoutes(mux, db, fakeResend(t, links, func(r *http.Request, to []string) {
		if r.Method != "POST" || r.URL.String() != "https://api.resend.com/emails" ||
			r.Header.Get("Authorization") != "Bearer test-key" || r.Header.Get("Idempotency-Key") == "" ||
			len(to) != 1 || to[0] != email {
			t.Error("unexpected Resend request")
		}
	}))

	request := func(method, action, body string, cookie *http.Cookie) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "/api/auth/"+action, strings.NewReader(body))
		if method == "POST" {
			r.Header.Set("Content-Type", "application/json")
		}
		if cookie != nil {
			r.AddCookie(cookie)
		}
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		return w
	}
	if w := request("POST", "link", `{"email":"unknown@example.com"}`, nil); w.Code != 202 {
		t.Fatalf("unknown account status = %d", w.Code)
	}
	for range 2 {
		if w := request("POST", "link", `{"email":"`+email+`"}`, nil); w.Code != 202 {
			t.Fatalf("link request status = %d", w.Code)
		}
	}
	var token string
	select {
	case token = <-links:
	case <-time.After(2 * time.Second):
		t.Fatal("no link sent")
	}
	var stored sellerLoginLink
	if err := db.First(&stored, "seller_email = ?", email).Error; err != nil || stored.TokenHash != tokenHash(token) {
		t.Fatalf("expected only a hash of the delivered token, query error = %v", err)
	}
	results := make(chan *httptest.ResponseRecorder, 2)
	for range 2 {
		go func() { results <- request("POST", "verify", `{"token":"`+token+`"}`, nil) }()
	}
	a, b := <-results, <-results
	if b.Code == 204 {
		a, b = b, a
	}
	if a.Code != 204 || b.Code != 401 {
		t.Fatalf("concurrent verification statuses = %d, %d", a.Code, b.Code)
	}
	cookies := a.Result().Cookies()
	if len(cookies) != 1 || !cookies[0].HttpOnly || cookies[0].SameSite != http.SameSiteLaxMode {
		t.Fatal("missing session cookie protections")
	}
	cookie := cookies[0]
	if w := request("GET", "session", "", cookie); w.Code != 200 || !strings.Contains(w.Body.String(), email) {
		t.Fatalf("expected an authenticated session, status = %d", w.Code)
	}
	if w := request("POST", "logout", "", cookie); w.Code != 204 {
		t.Fatalf("logout status = %d", w.Code)
	}
	if w := request("GET", "session", "", cookie); w.Code != 401 {
		t.Fatalf("revoked session status = %d", w.Code)
	}

	expired := rand.Text()
	if err := db.Create(&sellerLoginLink{SellerEmail: email, TokenHash: tokenHash(expired), ExpiresAt: time.Now().Add(-time.Minute)}).Error; err != nil {
		t.Fatal(err)
	}
	if w := request("POST", "verify", `{"token":"`+expired+`"}`, nil); w.Code != 401 {
		t.Fatalf("expired link status = %d", w.Code)
	}
	select {
	case <-links:
		t.Fatal("unknown or throttled request sent a second link")
	default:
	}
}

func TestSellerSignup(t *testing.T) {
	db := testDB(t)
	suffix := strings.ToLower(rand.Text())[:10]
	email, slug := "signup-"+suffix+"@example.com", "tienda-"+suffix
	t.Cleanup(func() {
		db.Delete(&shopMembership{}, "seller_email = ?", email)
		db.Delete(&shop{}, "slug = ?", slug)
		db.Delete(&seller{Email: email})
	})

	links := make(chan string, 2)
	mux := http.NewServeMux()
	authRoutes(mux, db, fakeResend(t, links, nil))
	post := func(action, body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("POST", "/api/auth/"+action, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		return w
	}

	if w := post("signup", `{"email":"`+email+`","shopName":"Tienda","shopSlug":"Mal Enlace"}`); w.Code != 400 {
		t.Fatalf("invalid slug status = %d", w.Code)
	}
	if w := post("signup", `{"email":"otra-`+suffix+`@example.com","shopName":"Luna","shopSlug":"luna-unas"}`); w.Code != 409 {
		t.Fatalf("taken slug status = %d", w.Code)
	}
	if w := post("signup", `{"email":"`+email+`","shopName":"Mi Tienda","shopSlug":"`+slug+`"}`); w.Code != 202 {
		t.Fatalf("signup status = %d", w.Code)
	}
	var count int64
	if db.Model(&shop{}).Where("slug = ?", slug).Count(&count); count != 0 {
		t.Fatal("shop created before the email was confirmed")
	}
	var token string
	select {
	case token = <-links:
	case <-time.After(2 * time.Second):
		t.Fatal("no link sent")
	}
	if w := post("verify", `{"token":"`+token+`"}`); w.Code != 204 {
		t.Fatalf("verify status = %d", w.Code)
	}
	var created shop
	if err := db.Take(&created, "slug = ?", slug).Error; err != nil || created.Name != "Mi Tienda" {
		t.Fatalf("expected the signed-up shop, err = %v", err)
	}
	if db.Model(&shopMembership{}).Where("seller_email = ? AND shop_slug = ?", email, slug).Count(&count); count != 1 {
		t.Fatal("seller does not manage the new shop")
	}
}
