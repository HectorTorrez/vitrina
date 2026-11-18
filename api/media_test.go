package main

import (
	"bytes"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"crypto/rand"
)

func TestImageUpload(t *testing.T) {
	db := testDB(t)
	t.Setenv("VITRINA_UPLOAD_DIR", t.TempDir())
	email := "media-" + strings.ToLower(rand.Text()) + "@example.com"
	if err := ensureSeller(db, email); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Delete(&seller{Email: email}) })
	token := sessionPrefix + rand.Text()
	db.Create(&sellerSession{TokenHash: tokenHash(token), SellerEmail: email, ExpiresAt: time.Now().Add(time.Hour)})
	mux := http.NewServeMux()
	mediaRoutes(mux, db)

	upload := func(body []byte, auth bool) *httptest.ResponseRecorder {
		r := httptest.NewRequest(http.MethodPost, "/api/panel/images", bytes.NewReader(body))
		if auth {
			r.AddCookie(&http.Cookie{Name: sessionCookie, Value: token})
		}
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		return w
	}
	var img bytes.Buffer
	pic := image.NewRGBA(image.Rect(0, 0, 2, 2))
	pic.Set(0, 0, color.Black)
	png.Encode(&img, pic)

	if w := upload(img.Bytes(), false); w.Code != 401 {
		t.Fatalf("anonymous upload: %d", w.Code)
	}
	if w := upload([]byte("<svg onload=alert(1)>"), true); w.Code != 415 {
		t.Fatalf("svg upload: %d", w.Code)
	}
	w := upload(img.Bytes(), true)
	var got struct{ URL string }
	json.Unmarshal(w.Body.Bytes(), &got)
	if w.Code != 201 || !validMediaPath(got.URL) || !strings.HasSuffix(got.URL, ".png") {
		t.Fatalf("upload: %d %s", w.Code, w.Body.String())
	}
	r := httptest.NewRequest(http.MethodGet, "/api"+got.URL, nil)
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, r)
	if w.Code != 200 || w.Header().Get("Content-Type") != "image/png" || !bytes.Equal(w.Body.Bytes(), img.Bytes()) {
		t.Fatalf("download: %d %s", w.Code, w.Header())
	}
	for _, path := range []string{"/api/media/..%2Fsecret.png", "/api/media/x.png"} {
		w = httptest.NewRecorder()
		mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet, path, nil))
		if w.Code != 404 {
			t.Fatalf("%s: %d", path, w.Code)
		}
	}
	item := product{Slug: "a", Name: "A", Kind: "product", ImageURL: got.URL}
	if err := validatePanelItem(&item); err != nil {
		t.Fatalf("uploaded path rejected: %v", err)
	}
	item.ImageURL = "/media/../../etc/passwd"
	if err := validatePanelItem(&item); err == nil {
		t.Fatal("expected traversal path to be rejected")
	}
}
