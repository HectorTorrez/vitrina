package main

import (
	"crypto/rand"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type resendTransport func(*http.Request) (*http.Response, error)

func (f resendTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}

func TestSellerEmailAccess(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set TEST_DATABASE_URL to an initialized PostgreSQL test database")
	}
	db, err := gorm.Open(postgres.Open(dsn))
	if err != nil {
		t.Fatal(err)
	}
	email := "test-" + strings.ToLower(rand.Text()) + "@example.com"
	if err := createSeller(db, []string{email}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Delete(&seller{Email: email}) })

	links := make(chan string, 3)
	origin := url.URL{Scheme: "https", Host: "vitrina.example"}
	mux := http.NewServeMux()
	authRoutes(mux, db, &resendDelivery{
		key: "test-key", from: "Vitrina <acceso@vitrina.example>", origin: origin,
		client: &http.Client{Transport: resendTransport(func(r *http.Request) (*http.Response, error) {
			var body struct {
				To   []string
				HTML string
			}
			if r.Method != "POST" || r.URL.String() != "https://api.resend.com/emails" ||
				r.Header.Get("Authorization") != "Bearer test-key" ||
				r.Header.Get("Idempotency-Key") == "" || json.NewDecoder(r.Body).Decode(&body) != nil ||
				len(body.To) != 1 || body.To[0] != email {
				t.Error("unexpected Resend request")
			}
			_, after, _ := strings.Cut(body.HTML, "https://vitrina.example/confirmar-acceso#")
			token, _, _ := strings.Cut(after, "\"")
			links <- token
			return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader("{}"))}, nil
		})},
	})

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
