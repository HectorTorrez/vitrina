package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"gorm.io/gorm"
)

type liveEvent struct {
	Shop   string   `json:"shop"`
	Topics []string `json:"topics"`
	At     int64    `json:"at"`
}

type eventHub struct {
	mu   sync.RWMutex
	subs map[string]map[chan liveEvent]struct{}
}

func newEventHub() *eventHub {
	return &eventHub{
		subs: make(map[string]map[chan liveEvent]struct{}),
	}
}

func (h *eventHub) subscribe(slugs ...string) (<-chan liveEvent, func()) {
	ch := make(chan liveEvent, 16)
	unique := make([]string, 0, len(slugs))
	seen := make(map[string]struct{}, len(slugs))
	for _, s := range slugs {
		if s == "" {
			continue
		}
		if _, ok := seen[s]; ok {
			continue
		}
		seen[s] = struct{}{}
		unique = append(unique, s)
	}

	h.mu.Lock()
	for _, slug := range unique {
		if h.subs[slug] == nil {
			h.subs[slug] = make(map[chan liveEvent]struct{})
		}
		h.subs[slug][ch] = struct{}{}
	}
	h.mu.Unlock()

	var once sync.Once
	cancel := func() {
		once.Do(func() {
			h.mu.Lock()
			for _, slug := range unique {
				if set := h.subs[slug]; set != nil {
					delete(set, ch)
					if len(set) == 0 {
						delete(h.subs, slug)
					}
				}
			}
			h.mu.Unlock()
		})
	}
	return ch, cancel
}

func (h *eventHub) publish(shopSlug string, topics ...string) {
	if shopSlug == "" || len(topics) == 0 {
		return
	}
	ev := liveEvent{
		Shop:   shopSlug,
		Topics: topics,
		At:     time.Now().UnixMilli(),
	}
	h.mu.RLock()
	set := h.subs[shopSlug]
	for ch := range set {
		select {
		case ch <- ev:
		default:
			// Slow consumer: drop oldest pending event and enqueue latest so we never block mutations.
			select {
			case <-ch:
			default:
			}
			select {
			case ch <- ev:
			default:
			}
		}
	}
	h.mu.RUnlock()
}

var liveHub = newEventHub()

func realtimeRoutes(mux *http.ServeMux, db *gorm.DB) {
	mux.HandleFunc("GET /api/shops/{slug}/stream", func(w http.ResponseWriter, r *http.Request) {
		slug := r.PathValue("slug")
		if !validSlug(slug) {
			http.Error(w, "Tienda inválida", http.StatusBadRequest)
			return
		}
		ch, cancel := liveHub.subscribe(slug)
		defer cancel()
		streamSSE(w, r, ch)
	})

	mux.HandleFunc("GET /api/panel/stream", authenticated(db, func(w http.ResponseWriter, r *http.Request, q *gorm.DB, account seller) {
		var slugs []string
		if err := q.Model(&shopMembership{}).Where("seller_email = ?", account.Email).Pluck("shop_slug", &slugs).Error; err != nil {
			writeError(w, err)
			return
		}
		ch, cancel := liveHub.subscribe(slugs...)
		defer cancel()
		streamSSE(w, r, ch)
	}))
}

func streamSSE(w http.ResponseWriter, r *http.Request, ch <-chan liveEvent) {
	rc := http.NewResponseController(w)
	_ = rc.SetWriteDeadline(time.Time{})

	h := w.Header()
	h.Set("Content-Type", "text/event-stream")
	h.Set("Cache-Control", "no-cache, no-transform")
	h.Set("Connection", "keep-alive")
	h.Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)

	if _, err := fmt.Fprint(w, ": connected\n\n"); err != nil {
		return
	}
	_ = rc.Flush()

	ticker := time.NewTicker(25 * time.Second)
	defer ticker.Stop()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case ev := <-ch:
			payload, err := json.Marshal(ev)
			if err != nil {
				continue
			}
			if _, err := fmt.Fprintf(w, "event: update\ndata: %s\n\n", payload); err != nil {
				return
			}
			_ = rc.Flush()
		case <-ticker.C:
			if _, err := fmt.Fprint(w, ": ping\n\n"); err != nil {
				return
			}
			_ = rc.Flush()
		}
	}
}
