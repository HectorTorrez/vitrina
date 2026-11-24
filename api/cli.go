package main

import (
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func runCommand(db *gorm.DB, name string, args []string) error {
	switch name {
	case "init":
		if len(args) > 1 {
			return errors.New("uso: init [CATALOGO_SQLITE]")
		}
		if err := db.AutoMigrate(&shop{}, &product{}, &reservation{}, &shopEvent{}, &shopOrder{}, &shopCoupon{}); err != nil {
			return err
		}
		if err := migrateAuth(db); err != nil {
			return err
		}
		if len(args) == 1 {
			if err := importCatalog(db, args[0]); err != nil {
				return err
			}
		}
		return seed(db)
	case "crear-vendedor":
		email, err := emailArgs(args, 1, "uso: crear-vendedor CORREO")
		if err != nil {
			return err
		}
		return ensureSeller(db, email)
	case "crear-operador":
		email, err := emailArgs(args, 1, "uso: crear-operador CORREO")
		if err != nil {
			return err
		}
		return grantOperator(db, email)
	case "asignar-tienda":
		email, err := emailArgs(args, 2, "uso: asignar-tienda CORREO TIENDA")
		if err != nil {
			return err
		}
		return assignShop(db, email, args[1])
	case "reservar":
		return reserveCommand(db, args)
	default:
		return errors.New("comando desconocido")
	}
}

func emailArgs(args []string, count int, usage string) (string, error) {
	if len(args) != count {
		return "", errors.New(usage)
	}
	email, valid := sellerEmail(args[0])
	if !valid {
		return "", errors.New("correo inválido")
	}
	return email, nil
}

func grantOperator(db *gorm.DB, email string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		if err := ensureSeller(tx, email); err != nil {
			return err
		}
		return tx.Model(&seller{}).Where("email = ?", email).Update("operator", true).Error
	})
}

func assignShop(db *gorm.DB, email, slug string) error {
	return db.Transaction(func(tx *gorm.DB) error {
		var s shop
		if err := tx.Take(&s, "slug = ?", slug).Error; err != nil {
			return err
		}
		if err := ensureSeller(tx, email); err != nil {
			return err
		}
		return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&shopMembership{SellerEmail: email, ShopSlug: s.Slug}).Error
	})
}

func reserveCommand(db *gorm.DB, args []string) error {
	if len(args) != 4 {
		return errors.New("uso: reservar TIENDA SERVICIO INICIO_RFC3339 CLIENTE")
	}
	start, err := time.Parse(time.RFC3339, args[2])
	if err != nil {
		return errors.New("indicá fecha, hora y zona horaria en formato RFC3339")
	}
	if !start.After(time.Now()) {
		return errors.New("indicá un horario futuro")
	}
	customer, err := cleanCustomer(args[3])
	if err != nil {
		return err
	}
	r, err := saveBooking(db, args[0], args[1], start, customer, "", 0)
	if err == nil {
		fmt.Printf("Reserva %d confirmada hasta %s\n", r.ID, r.EndsAt.Format(time.RFC3339))
	}
	return err
}
