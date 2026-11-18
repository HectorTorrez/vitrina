package main

import (
	"net/http"

	"gorm.io/gorm"
)

func catalogOrder(q *gorm.DB) *gorm.DB {
	return q.Order("position, slug")
}

func visibleProducts(q *gorm.DB) *gorm.DB {
	return catalogOrder(q.Where("hidden = ?", false))
}

func catalogRoutes(mux *http.ServeMux, db *gorm.DB) {
	mux.HandleFunc("GET /api/shops", func(w http.ResponseWriter, r *http.Request) {
		type entry struct {
			Slug        string   `json:"slug"`
			Name        string   `json:"name"`
			Description string   `json:"description"`
			Theme       string   `json:"theme"`
			Products    []string `json:"products"`
		}
		var shops []shop
		err := db.WithContext(r.Context()).Preload("Products", func(q *gorm.DB) *gorm.DB {
			return visibleProducts(q.Select("shop_slug", "slug"))
		}).Order("name, slug").Find(&shops).Error
		if err != nil {
			writeError(w, err)
			return
		}
		list := []entry{}
		for _, s := range shops {
			if len(s.Products) == 0 {
				continue
			}
			e := entry{Slug: s.Slug, Name: s.Name, Description: s.Description, Theme: s.Theme}
			for _, p := range s.Products {
				e.Products = append(e.Products, p.Slug)
			}
			list = append(list, e)
		}
		writeJSON(w, http.StatusOK, list)
	})

	mux.HandleFunc("GET /api/shops/{slug}", func(w http.ResponseWriter, r *http.Request) {
		var s shop
		err := db.WithContext(r.Context()).Preload("Products", visibleProducts).Take(&s, "slug = ?", r.PathValue("slug")).Error
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, s)
	})
}
