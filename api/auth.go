package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const sessionCookie = "vitrina_session"
const sessionLifetime = 7 * 24 * time.Hour

const linkLifetime = 15 * time.Minute
const linkCooldown = time.Minute
const sessionPrefix = "email_"

type seller struct {
	Email      string `gorm:"primaryKey"`
	LastLinkAt *time.Time
	Operator   bool `gorm:"not null;default:false"`
}

type sellerLoginLink struct {
	SellerEmail string    `gorm:"primaryKey"`
	Seller      seller    `gorm:"foreignKey:SellerEmail;references:Email;constraint:OnDelete:CASCADE"`
	TokenHash   string    `gorm:"uniqueIndex;not null"`
	ExpiresAt   time.Time `gorm:"not null"`
}

type sellerSession struct {
	TokenHash   string    `gorm:"primaryKey"`
	SellerEmail string    `gorm:"not null"`
	Seller      seller    `gorm:"foreignKey:SellerEmail;references:Email;constraint:OnDelete:CASCADE"`
	ExpiresAt   time.Time `gorm:"index;not null"`
}

func migrateAuth(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.AutoMigrate(&seller{}, &sellerLoginLink{}, &sellerSession{}, &shopMembership{}); err != nil {
			return err
		}
		// Allow email-only accounts in databases initialized with password credentials.
		for _, column := range []string{"salt", "hash"} {
			if tx.Migrator().HasColumn("sellers", column) {
				if err := tx.Exec("ALTER TABLE sellers ALTER COLUMN " + column + " DROP NOT NULL").Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
}

func sellerEmail(input string) (string, bool) {
	email := strings.ToLower(strings.TrimSpace(input))
	address, err := mail.ParseAddress(email)
	return email, len(email) <= 254 && err == nil && address.Address == email
}

func createSeller(db *gorm.DB, args []string) error {
	if len(args) != 1 {
		return errors.New("uso: crear-vendedor CORREO")
	}
	email, valid := sellerEmail(args[0])
	if !valid {
		return errors.New("correo inválido")
	}
	return db.Clauses(clause.OnConflict{DoNothing: true}).Create(&seller{Email: email}).Error
}

func tokenHash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func readAuthJSON(w http.ResponseWriter, r *http.Request, data any) bool {
	w.Header().Set("Cache-Control", "no-store")
	return readJSON(w, r, data, 8192)
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

func authRoutes(mux *http.ServeMux, db *gorm.DB, delivery *resendDelivery) {
	sendSlots := make(chan struct{}, 2)
	mux.HandleFunc("POST /api/auth/link", func(w http.ResponseWriter, r *http.Request) {
		var input struct{ Email string }
		if !readAuthJSON(w, r, &input) {
			return
		}
		email, valid := sellerEmail(input.Email)
		if !valid {
			http.Error(w, "Correo inválido", http.StatusBadRequest)
			return
		}
		if delivery == nil {
			http.Error(w, "El acceso por correo todavía no está configurado", http.StatusServiceUnavailable)
			return
		}
		sending := false
		select {
		case sendSlots <- struct{}{}:
			defer func() {
				if !sending {
					<-sendSlots
				}
			}()
		default:
			w.WriteHeader(http.StatusTooManyRequests)
			return
		}
		q := db.WithContext(r.Context())
		now, token := time.Now(), rand.Text()
		var issued bool
		err := q.Transaction(func(tx *gorm.DB) error {
			result := tx.Model(&seller{}).
				Where("email = ? AND (last_link_at IS NULL OR last_link_at <= ?)", email, now.Add(-linkCooldown)).
				Update("last_link_at", now)
			if result.Error != nil || result.RowsAffected == 0 {
				return result.Error
			}
			issued = true
			return tx.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "seller_email"}},
				DoUpdates: clause.AssignmentColumns([]string{"token_hash", "expires_at"}),
			}).Create(&sellerLoginLink{SellerEmail: email, TokenHash: tokenHash(token), ExpiresAt: now.Add(linkLifetime)}).Error
		})
		if err != nil {
			authFailure(w)
			return
		}
		if issued {
			sending = true
			go func() {
				defer func() { <-sendSlots }()
				if err := delivery.sendLoginLink(context.Background(), email, token); err != nil {
					log.Printf("No se pudo enviar el enlace de acceso: %v", err)
				}
			}()
		}
		// Keep the response uniform for enrolled, unknown and throttled addresses.
		w.WriteHeader(http.StatusAccepted)
	})

	mux.HandleFunc("POST /api/auth/verify", func(w http.ResponseWriter, r *http.Request) {
		var input struct{ Token string }
		if !readAuthJSON(w, r, &input) {
			return
		}
		if len(input.Token) < 26 || len(input.Token) > 128 {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		q := db.WithContext(r.Context())
		token, now := sessionPrefix+rand.Text(), time.Now()
		err := q.Transaction(func(tx *gorm.DB) error {
			var link sellerLoginLink
			result := tx.Clauses(clause.Returning{}).
				Where("token_hash = ? AND expires_at > ?", tokenHash(input.Token), now).
				Delete(&link)
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				return gorm.ErrRecordNotFound
			}
			if err := tx.Delete(&sellerSession{}, "expires_at <= ?", now).Error; err != nil {
				return err
			}
			if previous, err := r.Cookie(sessionCookie); err == nil {
				if err := tx.Delete(&sellerSession{}, "token_hash = ?", tokenHash(previous.Value)).Error; err != nil {
					return err
				}
			}
			return tx.Create(&sellerSession{TokenHash: tokenHash(token), SellerEmail: link.SellerEmail, ExpiresAt: now.Add(sessionLifetime)}).Error
		})
		if errors.Is(err, gorm.ErrRecordNotFound) {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		if err != nil {
			authFailure(w)
			return
		}
		writeSessionCookie(w, token, int(sessionLifetime.Seconds()))
		w.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("GET /api/auth/session", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "private, no-store")
		session, err := lookupSession(db.WithContext(r.Context()), r)
		if errors.Is(err, gorm.ErrRecordNotFound) {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		if err != nil {
			authFailure(w)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"email": session.SellerEmail})
	})
	mux.HandleFunc("POST /api/auth/logout", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		if r.Header.Get("Content-Type") != "application/json" {
			w.WriteHeader(http.StatusUnsupportedMediaType)
			return
		}
		if cookie, err := r.Cookie(sessionCookie); err == nil {
			if err := db.WithContext(r.Context()).Delete(&sellerSession{}, "token_hash = ?", tokenHash(cookie.Value)).Error; err != nil {
				authFailure(w)
				return
			}
		}
		writeSessionCookie(w, "", -1)
		w.WriteHeader(http.StatusNoContent)
	})
}

func writeSessionCookie(w http.ResponseWriter, token string, maxAge int) {
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: token, Path: "/", HttpOnly: true, SameSite: http.SameSiteLaxMode, MaxAge: maxAge})
}

func authFailure(w http.ResponseWriter) {
	http.Error(w, "No se pudo procesar la sesión", http.StatusInternalServerError)
}
