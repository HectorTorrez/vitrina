package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"gorm.io/gorm"
)

const reminderPollInterval = 5 * time.Minute

func startReminderWorker(ctx context.Context, db *gorm.DB, delivery *resendDelivery) {
	if delivery == nil {
		return
	}
	run := func() {
		runCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		defer cancel()
		sent, err := processBookingReminders(runCtx, db, delivery, time.Now())
		if err != nil {
			log.Printf("Error procesando recordatorios de citas: %v", err)
		} else if sent > 0 {
			log.Printf("Recordatorios de citas enviados: %d", sent)
		}
	}
	// Small initial delay so startup stays snappy.
	select {
	case <-time.After(20 * time.Second):
		run()
	case <-ctx.Done():
		return
	}
	ticker := time.NewTicker(reminderPollInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			run()
		case <-ctx.Done():
			return
		}
	}
}

func reminderEmailContent(booking reservation, service product, s shop, manageURL string, locale string) (subject, text string) {
	locale = resolveEmailLocale(s, locale)
	loc := s.location()
	tz := s.Timezone
	if tz == "" {
		tz = "America/El_Salvador"
	}
	when := booking.StartsAt.In(loc).Format("02/01/2006 15:04")
	staffName := s.staffName(booking.StaffID)
	svcName := service.Name
	if svcName == "" {
		svcName = booking.ServiceSlug
	}
	if locale == "en" {
		subject = "Reminder: " + svcName + " at " + s.Name + " · " + when
		text = "Friendly reminder of your upcoming appointment at " + s.Name + ".\n\n" +
			"Service: " + svcName + "\n"
		if staffName != "" {
			text += "Specialist: " + staffName + "\n"
		}
		text += "Date: " + when + " (" + tz + ")\n"
		if s.Address != "" {
			text += "Address: " + s.Address + "\n"
		}
		if manageURL != "" {
			text += "\nNeed to reschedule or cancel? Manage your booking here:\n" + manageURL
		}
		return subject, text
	}
	subject = "Recordatorio: " + svcName + " en " + s.Name + " · " + when
	text = "Te recordamos tu próxima cita en " + s.Name + ".\n\n" +
		"Servicio: " + svcName + "\n"
	if staffName != "" {
		text += "Especialista: " + staffName + "\n"
	}
	text += "Fecha: " + when + " (" + tz + ")\n"
	if s.Address != "" {
		text += "Dirección: " + s.Address + "\n"
	}
	if manageURL != "" {
		text += "\n¿Necesitás reprogramar o cancelar? Gestioná tu cita aquí:\n" + manageURL
	}
	return subject, text
}

func processBookingReminders(ctx context.Context, db *gorm.DB, delivery *resendDelivery, now time.Time) (int, error) {
	if delivery == nil {
		return 0, nil
	}
	var pending []reservation
	maxWindow := now.Add(72 * time.Hour)
	err := db.WithContext(ctx).
		Where("cancelled_at IS NULL AND email <> '' AND starts_at > ? AND starts_at <= ? AND (reminder1_sent_at IS NULL OR reminder2_sent_at IS NULL)", now, maxWindow).
		Order("starts_at").
		Find(&pending).Error
	if err != nil {
		return 0, err
	}
	if len(pending) == 0 {
		return 0, nil
	}
	shopSlugs := make([]string, 0, len(pending))
	seenShop := make(map[string]bool)
	for _, r := range pending {
		if !seenShop[r.ShopSlug] {
			seenShop[r.ShopSlug] = true
			shopSlugs = append(shopSlugs, r.ShopSlug)
		}
	}
	var shops []shop
	if err := db.WithContext(ctx).Preload("Products").Where("slug IN ?", shopSlugs).Find(&shops).Error; err != nil {
		return 0, err
	}
	shopsBySlug := make(map[string]shop, len(shops))
	for _, s := range shops {
		shopsBySlug[s.Slug] = s
	}

	sent := 0
	for _, r := range pending {
		s, ok := shopsBySlug[r.ShopSlug]
		if !ok {
			continue
		}
		var svc product
		for _, p := range s.Products {
			if p.Slug == r.ServiceSlug {
				svc = p
				break
			}
		}
		untilStart := r.StartsAt.Sub(now)
		sendSlot := func(slot int, hoursBefore int, col string) {
			if hoursBefore <= 0 || untilStart > time.Duration(hoursBefore)*time.Hour {
				return
			}
			subject, text := reminderEmailContent(r, svc, s, manageBookingURL(delivery, r), s.Locale)
			key := fmt.Sprintf("vitrina-reminder-%d/%s/%d/%d", slot, r.ShopSlug, r.ID, r.StartsAt.Unix())
			if err := delivery.send(ctx, []string{r.Email}, subject, text, key); err != nil {
				log.Printf("No se pudo enviar recordatorio %d de cita %d: %v", slot, r.ID, err)
				return
			}
			if err := db.WithContext(ctx).Model(&reservation{}).Where("id = ?", r.ID).Update(col, now).Error; err != nil {
				log.Printf("No se pudo marcar recordatorio %d de cita %d: %v", slot, r.ID, err)
				return
			}
			sent++
		}
		if r.Reminder1SentAt == nil && s.BookingConfig.ReminderHoursBefore > 0 {
			sendSlot(1, s.BookingConfig.ReminderHoursBefore, "reminder1_sent_at")
		}
		if r.Reminder2SentAt == nil && s.BookingConfig.Reminder2HoursBefore > 0 {
			sendSlot(2, s.BookingConfig.Reminder2HoursBefore, "reminder2_sent_at")
		}
	}
	return sent, nil
}
