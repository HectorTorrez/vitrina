package main

import (
	"bufio"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"
	"time"
)

func TestEventHubPubSubAndSlowConsumer(t *testing.T) {
	hub := newEventHub()
	ch, cancel := hub.subscribe("luna", "sol", "luna")
	defer cancel()

	hub.publish("luna", "shop", "bookings")
	select {
	case ev := <-ch:
		if ev.Shop != "luna" || !slices.Equal(ev.Topics, []string{"shop", "bookings"}) {
			t.Fatalf("unexpected event: %+v", ev)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for luna event")
	}

	// Unrelated shop does not deliver.
	hub.publish("otra", "bookings")
	select {
	case ev := <-ch:
		t.Fatalf("unexpected event for other shop: %+v", ev)
	default:
	}

	// Slow consumer must not block publish; latest event should still be buffered.
	for range 32 {
		hub.publish("sol", "orders")
	}

	cancel()
	hub.publish("luna", "bookings")
	// Drain any buffered events from sol, ensure none from luna after cancel.
	for {
		select {
		case ev := <-ch:
			if ev.Shop == "luna" {
				t.Fatalf("received event after unsubscribe: %+v", ev)
			}
		default:
			return
		}
	}
}

func TestShopStreamSSE(t *testing.T) {
	mux := http.NewServeMux()
	realtimeRoutes(mux, nil)
	srv := httptest.NewServer(mux)
	defer srv.Close()

	// Invalid slug returns 400.
	badRes, err := http.Get(srv.URL + "/api/shops/INVALID_SLUG!/stream")
	if err != nil {
		t.Fatal(err)
	}
	badRes.Body.Close()
	if badRes.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid slug, got %d", badRes.StatusCode)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, srv.URL+"/api/shops/luna-unas/stream", nil)
	if err != nil {
		t.Fatal(err)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()

	if ct := res.Header.Get("Content-Type"); !strings.HasPrefix(ct, "text/event-stream") {
		t.Fatalf("expected text/event-stream, got %q", ct)
	}

	scanner := bufio.NewScanner(res.Body)
	// First line should be ": connected"
	if !scanner.Scan() || scanner.Text() != ": connected" {
		t.Fatalf("expected ': connected', got %q (err=%v)", scanner.Text(), scanner.Err())
	}

	go func() {
		time.Sleep(20 * time.Millisecond)
		liveHub.publish("luna-unas", "shop", "bookings")
	}()

	var eventName, dataLine string
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "event: ") {
			eventName = strings.TrimPrefix(line, "event: ")
		} else if strings.HasPrefix(line, "data: ") {
			dataLine = strings.TrimPrefix(line, "data: ")
			break
		}
	}
	if eventName != "update" {
		t.Fatalf("expected event 'update', got %q", eventName)
	}
	var got liveEvent
	if err := json.Unmarshal([]byte(dataLine), &got); err != nil {
		t.Fatalf("invalid json payload %q: %v", dataLine, err)
	}
	if got.Shop != "luna-unas" || !slices.Equal(got.Topics, []string{"shop", "bookings"}) {
		t.Fatalf("unexpected SSE event: %+v", got)
	}
}
