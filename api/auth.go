package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"log"
	"net/http"
	"net/mail"
	"strings"
	"time"
	"unicode/utf8"

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

func ensureSeller(db *gorm.DB, email string) error {
	return db.Clauses(clause.OnConflict{DoNothing: true}).Create(&seller{Email: email}).Error
}

type sellerLoginLink struct {
	SellerEmail string    `gorm:"primaryKey"`
	Seller      seller    `gorm:"foreignKey:SellerEmail;references:Email;constraint:OnDelete:CASCADE"`
	TokenHash   string    `gorm:"uniqueIndex;not null"`
	ExpiresAt   time.Time `gorm:"not null"`
}

// shopSignup holds the shop a new seller asked for until they confirm their email.
type shopSignup struct {
	SellerEmail string    `gorm:"primaryKey"`
	Seller      seller    `gorm:"foreignKey:SellerEmail;references:Email;constraint:OnDelete:CASCADE"`
	Slug        string    `gorm:"not null"`
	Name        string    `gorm:"not null"`
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
		if err := tx.AutoMigrate(&seller{}, &sellerLoginLink{}, &sellerSession{}, &shopMembership{}, &shopSignup{}); err != nil {
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

func tokenHash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func authRoutes(mux *http.ServeMux, db *gorm.DB, delivery *resendDelivery) {
	sendSlots := make(chan struct{}, 2)
	// sendLink emails a sign-in link to email after prepare runs in the same transaction.
	// Unknown and throttled addresses get the same 202 response without an email.
	sendLink := func(w http.ResponseWriter, r *http.Request, email string, prepare func(tx *gorm.DB) error) {
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
			if prepare != nil {
				if err := prepare(tx); err != nil {
					return err
				}
			}
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
			writeError(w, err)
			return
		}
		if issued {
			sending = true
			locale := requestLocale(r)
			go func() {
				defer func() { <-sendSlots }()
				if err := delivery.sendLoginLink(context.Background(), email, token, locale); err != nil {
					log.Printf("No se pudo enviar el enlace de acceso: %v", err)
				}
			}()
		}
		w.WriteHeader(http.StatusAccepted)
	}

	mux.HandleFunc("POST /api/auth/link", func(w http.ResponseWriter, r *http.Request) {
		var input struct{ Email string }
		if !readJSON(w, r, &input, 8192) {
			return
		}
		email, valid := sellerEmail(input.Email)
		if !valid {
			http.Error(w, "Correo inválido", http.StatusBadRequest)
			return
		}
		sendLink(w, r, email, nil)
	})

	// Self-service sign-up: the shop is created only when the seller opens the emailed link.
	mux.HandleFunc("POST /api/auth/signup", func(w http.ResponseWriter, r *http.Request) {
		var input struct{ Email, ShopName, ShopSlug string }
		if !readJSON(w, r, &input, 8192) {
			return
		}
		email, valid := sellerEmail(input.Email)
		name := strings.TrimSpace(input.ShopName)
		if !valid || !validSlug(input.ShopSlug) || name == "" || utf8.RuneCountInString(name) > 100 {
			http.Error(w, "Datos inválidos", http.StatusBadRequest)
			return
		}
		sendLink(w, r, email, func(tx *gorm.DB) error {
			var taken int64
			if err := tx.Model(&shop{}).Where("slug = ?", input.ShopSlug).Count(&taken).Error; err != nil {
				return err
			}
			if taken > 0 {
				return errConflict
			}
			if err := ensureSeller(tx, email); err != nil {
				return err
			}
			return tx.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "seller_email"}},
				DoUpdates: clause.AssignmentColumns([]string{"slug", "name", "expires_at"}),
			}).Create(&shopSignup{SellerEmail: email, Slug: input.ShopSlug, Name: name, ExpiresAt: time.Now().Add(linkLifetime)}).Error
		})
	})

	mux.HandleFunc("POST /api/auth/verify", func(w http.ResponseWriter, r *http.Request) {
		var input struct{ Token string }
		if !readJSON(w, r, &input, 8192) {
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
			if err := openSignupShop(tx, link.SellerEmail, now); err != nil {
				return err
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
			writeError(w, err)
			return
		}
		writeSessionCookie(w, token, int(sessionLifetime.Seconds()))
		w.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("GET /api/auth/session", func(w http.ResponseWriter, r *http.Request) {
		session, err := lookupSession(db.WithContext(r.Context()), r)
		if errors.Is(err, gorm.ErrRecordNotFound) {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"email": session.SellerEmail})
	})
	mux.HandleFunc("POST /api/auth/logout", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Content-Type") != "application/json" {
			w.WriteHeader(http.StatusUnsupportedMediaType)
			return
		}
		if cookie, err := r.Cookie(sessionCookie); err == nil {
			if err := db.WithContext(r.Context()).Delete(&sellerSession{}, "token_hash = ?", tokenHash(cookie.Value)).Error; err != nil {
				writeError(w, err)
				return
			}
		}
		writeSessionCookie(w, "", -1)
		w.WriteHeader(http.StatusNoContent)
	})
}

// openSignupShop creates the shop a seller signed up for, once they prove they own the email.
// Sellers who already manage a shop, or whose link was taken meanwhile, just sign in.
func openSignupShop(tx *gorm.DB, email string, now time.Time) error {
	var pending shopSignup
	result := tx.Clauses(clause.Returning{}).Where("seller_email = ?", email).Delete(&pending)
	if result.Error != nil || result.RowsAffected == 0 || !pending.ExpiresAt.After(now) {
		return result.Error
	}
	var owned int64
	if err := tx.Model(&shopMembership{}).Where("seller_email = ?", email).Count(&owned).Error; err != nil || owned > 0 {
		return err
	}
	created := tx.Clauses(clause.OnConflict{DoNothing: true}).
		Create(&shop{Slug: pending.Slug, Name: pending.Name, Theme: "costa", Hours: []dayHours{}})
	if created.Error != nil || created.RowsAffected == 0 {
		return created.Error
	}
	return tx.Create(&shopMembership{SellerEmail: email, ShopSlug: pending.Slug}).Error
}

func lookupSession(db *gorm.DB, r *http.Request) (sellerSession, error) {
	var session sellerSession
	cookie, err := r.Cookie(sessionCookie)
	if err != nil || !strings.HasPrefix(cookie.Value, sessionPrefix) {
		return session, gorm.ErrRecordNotFound
	}
	err = db.First(&session, "token_hash = ? AND expires_at > ?", tokenHash(cookie.Value), time.Now()).Error
	return session, err
}

func writeSessionCookie(w http.ResponseWriter, token string, maxAge int) {
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: token, Path: "/", HttpOnly: true, SameSite: http.SameSiteLaxMode, MaxAge: maxAge})
}
