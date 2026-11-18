package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func testDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("set TEST_DATABASE_URL to an initialized PostgreSQL test database")
	}
	db, err := gorm.Open(postgres.Open(dsn))
	if err != nil {
		t.Fatal(err)
	}
	return db
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

// fakeResend delivers sign-in emails to links as the token in their confirmation URL.
func fakeResend(t *testing.T, links chan<- string, check func(r *http.Request, to []string)) *resendDelivery {
	return &resendDelivery{
		key: "test-key", from: "Vitrina <acceso@vitrina.example>", origin: url.URL{Scheme: "https", Host: "vitrina.example"},
		client: &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			var body struct {
				To   []string
				HTML string
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				t.Error(err)
			}
			if check != nil {
				check(r, body.To)
			}
			_, after, _ := strings.Cut(body.HTML, "https://vitrina.example/confirmar-acceso#")
			token, _, _ := strings.Cut(after, "\"")
			links <- token
			return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader("{}"))}, nil
		})},
	}
}
