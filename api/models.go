package main

import (
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"time"
)

type option struct {
	Name   string   `json:"name"`
	Values []string `json:"values"`
}
type product struct {
	ShopSlug        string   `json:"-" gorm:"primaryKey"`
	Slug            string   `json:"slug" gorm:"primaryKey"`
	Name            string   `json:"name"`
	PriceCents      int      `json:"priceCents" gorm:"check:price_cents >= 0"`
	Available       bool     `json:"available"`
	Artwork         string   `json:"artwork"`
	Options         []option `json:"options" gorm:"serializer:json;type:jsonb"`
	Position        int      `json:"-"`
	Kind            string   `json:"kind" gorm:"not null;check:(kind = 'product' AND duration_minutes = 0) OR (kind = 'service' AND duration_minutes BETWEEN 1 AND 1440)"`
	DurationMinutes int      `json:"durationMinutes" gorm:"not null"`
}
type shop struct {
	Slug        string    `json:"-" gorm:"primaryKey"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Theme       string    `json:"theme"`
	Instagram   string    `json:"instagram"`
	TikTok      string    `json:"tiktok" gorm:"column:tiktok"`
	Whatsapp    string    `json:"whatsapp"`
	Products    []product `json:"products" gorm:"foreignKey:ShopSlug;references:Slug"`
}
type reservation struct {
	ID          uint      `gorm:"primaryKey"`
	ShopSlug    string    `gorm:"index:agenda,priority:1;not null"`
	ServiceSlug string    `gorm:"not null"`
	Service     product   `gorm:"foreignKey:ShopSlug,ServiceSlug;references:ShopSlug,Slug"`
	Customer    string    `gorm:"not null"`
	StartsAt    time.Time `gorm:"index:agenda,priority:2;not null"`
	EndsAt      time.Time `gorm:"not null;check:ends_at > starts_at"`
}

func seed(db *gorm.DB) error {
	sizes := option{"Tamaño", []string{"A4", "A3"}}
	shops := []shop{
		{Slug: "marea-estudio", Name: "Marea Estudio", Description: "Láminas de autor impresas en San Salvador.", Theme: "costa", Instagram: "marea.estudio", TikTok: "marea.prints"},
		{Slug: "luna-unas", Name: "Luna Uñas", Description: "Manicura y cuidado de uñas con cita previa.", Theme: "arena"},
	}
	items := []product{
		{ShopSlug: "marea-estudio", Slug: "sol-de-tarde", Name: "Sol de tarde", Kind: "product", PriceCents: 1800, Available: true, Artwork: "sol-de-tarde", Options: []option{sizes, {"Tipo de papel", []string{"Mate", "Satinado"}}}, Position: 1},
		{ShopSlug: "marea-estudio", Slug: "marea-baja", Name: "Marea baja", Kind: "product", PriceCents: 1800, Available: true, Artwork: "marea-baja", Options: []option{sizes}, Position: 2},
		{ShopSlug: "marea-estudio", Slug: "noche-azul", Name: "Noche azul", Kind: "product", PriceCents: 1800, Artwork: "noche-azul", Options: []option{}, Position: 3},
		{ShopSlug: "luna-unas", Slug: "manicura-gel", Name: "Manicura en gel", Kind: "service", DurationMinutes: 45, PriceCents: 2000, Available: true, Options: []option{}, Position: 1},
	}
	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&shops).Error; err != nil {
			return err
		}
		return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&items).Error
	})
}
