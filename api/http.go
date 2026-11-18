package main

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"

	"gorm.io/gorm"
)

// validationError is a message for the person who sent the request.
type validationError string

func (e validationError) Error() string { return string(e) }

var (
	errForbidden = errors.New("No tenés permiso para realizar esta acción")
	errConflict  = errors.New("Ese enlace ya está en uso")
)

func noStore(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}

func readJSON(w http.ResponseWriter, r *http.Request, data any, limit int64) bool {
	if r.Header.Get("Content-Type") != "application/json" {
		w.WriteHeader(http.StatusUnsupportedMediaType)
		return false
	}
	r.Body = http.MaxBytesReader(w, r.Body, limit)
	decoder := json.NewDecoder(r.Body)
	if decoder.Decode(data) != nil || decoder.Decode(new(any)) != io.EOF {
		http.Error(w, "Datos inválidos", http.StatusBadRequest)
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, err error) {
	var invalid validationError
	switch {
	case errors.As(err, &invalid):
		http.Error(w, err.Error(), http.StatusBadRequest)
	case errors.Is(err, errForbidden):
		http.Error(w, err.Error(), http.StatusForbidden)
	case errors.Is(err, errConflict), errors.Is(err, errOccupied):
		http.Error(w, err.Error(), http.StatusConflict)
	case errors.Is(err, gorm.ErrRecordNotFound):
		http.Error(w, "No se encontró el registro solicitado", http.StatusNotFound)
	default:
		log.Print(err)
		http.Error(w, "No se pudo completar la operación", http.StatusInternalServerError)
	}
}

// authenticated runs next for the seller behind the request's session cookie, or answers 401.
func authenticated(db *gorm.DB, next func(w http.ResponseWriter, r *http.Request, q *gorm.DB, account seller)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := db.WithContext(r.Context())
		var account seller
		session, err := lookupSession(q, r)
		if err == nil {
			err = q.Take(&account, "email = ?", session.SellerEmail).Error
		}
		if errors.Is(err, gorm.ErrRecordNotFound) {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		if err != nil {
			writeError(w, err)
			return
		}
		next(w, r, q, account)
	}
}
