package main

import (
	"net/http"
	"time"

	"gorm.io/gorm"
)

type shopEvent struct {
	ID         uint      `gorm:"primaryKey"`
	ShopSlug   string    `gorm:"index:idx_shop_events,priority:1;not null"`
	EventType  string    `gorm:"index:idx_shop_events,priority:2;not null"`
	TargetSlug string    `gorm:"not null;default:''"`
	CreatedAt  time.Time `gorm:"index:idx_shop_events,priority:3;not null"`
}

type topItemStat struct {
	Slug  string `json:"slug"`
	Views int64  `json:"views"`
}

type shopAnalytics struct {
	Views30d          int64         `json:"views30d"`
	ProductViews30d   int64         `json:"productViews30d"`
	WhatsappClicks30d int64         `json:"whatsappClicks30d"`
	TopItems          []topItemStat `json:"topItems"`
}

func analyticsRoutes(mux *http.ServeMux, db *gorm.DB) {
	mux.HandleFunc("POST /api/shops/{slug}/events", func(w http.ResponseWriter, r *http.Request) {
		shopSlug := r.PathValue("slug")
		if !validSlug(shopSlug) {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		var input struct {
			Type   string `json:"type"`
			Target string `json:"target"`
		}
		if !readJSON(w, r, &input, 1024) {
			return
		}
		if input.Type != "shop_view" && input.Type != "product_view" && input.Type != "whatsapp_click" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		if input.Target != "" && !validSlug(input.Target) {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		q := db.WithContext(r.Context())
		var exists int64
		if err := q.Model(&shop{}).Where("slug = ?", shopSlug).Count(&exists).Error; err != nil || exists == 0 {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		_ = q.Create(&shopEvent{
			ShopSlug:   shopSlug,
			EventType:  input.Type,
			TargetSlug: input.Target,
			CreatedAt:  time.Now(),
		}).Error
		w.WriteHeader(http.StatusNoContent)
	})
}

func loadPanelAnalytics(db *gorm.DB, email string) map[string]shopAnalytics {
	result := make(map[string]shopAnalytics)
	since := time.Now().AddDate(0, 0, -30)
	sub := db.Model(&shopMembership{}).Select("shop_slug").Where("seller_email = ?", email)

	type countRow struct {
		ShopSlug  string
		EventType string
		Count     int64
	}
	var counts []countRow
	if err := db.Model(&shopEvent{}).
		Select("shop_slug, event_type, count(*) as count").
		Where("shop_slug IN (?) AND created_at >= ?", sub, since).
		Group("shop_slug, event_type").
		Scan(&counts).Error; err != nil {
		return result
	}
	for _, row := range counts {
		stat := result[row.ShopSlug]
		switch row.EventType {
		case "shop_view":
			stat.Views30d = row.Count
		case "product_view":
			stat.ProductViews30d = row.Count
		case "whatsapp_click":
			stat.WhatsappClicks30d = row.Count
		}
		result[row.ShopSlug] = stat
	}

	type topRow struct {
		ShopSlug   string
		TargetSlug string
		Count      int64
	}
	var top []topRow
	if err := db.Model(&shopEvent{}).
		Select("shop_slug, target_slug, count(*) as count").
		Where("shop_slug IN (?) AND event_type = ? AND target_slug <> '' AND created_at >= ?", sub, "product_view", since).
		Group("shop_slug, target_slug").
		Order("count DESC").
		Scan(&top).Error; err == nil {
		for _, row := range top {
			stat := result[row.ShopSlug]
			if len(stat.TopItems) < 5 {
				stat.TopItems = append(stat.TopItems, topItemStat{Slug: row.TargetSlug, Views: row.Count})
				result[row.ShopSlug] = stat
			}
		}
	}
	return result
}
