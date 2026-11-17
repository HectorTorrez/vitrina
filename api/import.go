package main

import (
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"net/url"
	"path/filepath"
)

// Import the previous catalog before inserting demo records. Existing destination keys cause a rollback.
func importCatalog(dest *gorm.DB, path string) error {
	absolute, err := filepath.Abs(path)
	if err != nil {
		return err
	}
	uri := url.URL{Scheme: "file", Path: absolute, RawQuery: "mode=ro"}
	source, err := gorm.Open(sqlite.Open(uri.String()), &gorm.Config{})
	if err != nil {
		return err
	}
	conn, err := source.DB()
	if err != nil {
		return err
	}
	defer conn.Close()
	return source.Transaction(func(src *gorm.DB) error {
		var shops []shop
		if err := src.Preload("Products").Find(&shops).Error; err != nil {
			return err
		}
		return dest.Transaction(func(tx *gorm.DB) error {
			for _, s := range shops {
				if err := tx.Omit("Products").Create(&s).Error; err != nil {
					return err
				}
				for _, p := range s.Products {
					p.Kind = "product"
					if err := tx.Create(&p).Error; err != nil {
						return err
					}
				}
			}
			return nil
		})
	})
}
