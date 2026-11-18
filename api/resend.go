package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"log"
	"net/http"
	"net/mail"
	"net/url"
	"os"
	"strings"
	"time"
)

type resendDelivery struct {
	key    string
	from   string
	origin url.URL
	client *http.Client
}

// configureResend returns nil when email is off. Without RESEND_API_KEY and with a local
// VITRINA_WEB_ORIGIN, messages are printed to the API log so sign-up works in development.
func configureResend() (*resendDelivery, error) {
	key := strings.TrimSpace(os.Getenv("RESEND_API_KEY"))
	from := strings.TrimSpace(os.Getenv("RESEND_FROM"))
	rawOrigin := os.Getenv("VITRINA_WEB_ORIGIN")
	if key == "" && rawOrigin == "" {
		return nil, nil
	}
	origin, err := url.Parse(rawOrigin)
	if err != nil || origin.Hostname() == "" || origin.User != nil ||
		(origin.Path != "" && origin.Path != "/") || origin.RawQuery != "" || origin.ForceQuery || origin.Fragment != "" {
		return nil, errors.New("VITRINA_WEB_ORIGIN debe contener el origen público de Vitrina")
	}
	local := origin.Hostname() == "localhost" || origin.Hostname() == "127.0.0.1" || origin.Hostname() == "::1"
	if origin.Scheme != "https" && !(local && origin.Scheme == "http") {
		return nil, errors.New("VITRINA_WEB_ORIGIN requiere HTTPS fuera del entorno local")
	}
	if key == "" {
		if !local {
			return nil, nil
		}
		log.Print("Sin RESEND_API_KEY: los correos se muestran en este registro en lugar de enviarse")
		return &resendDelivery{origin: *origin}, nil
	}
	if from == "" {
		return nil, errors.New("configurá RESEND_API_KEY y RESEND_FROM juntos")
	}
	if _, err := mail.ParseAddress(from); err != nil {
		return nil, errors.New("RESEND_FROM debe contener un remitente válido")
	}
	return &resendDelivery{
		key: key, from: from, origin: *origin,
		client: &http.Client{Timeout: 4 * time.Second, CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			return http.ErrUseLastResponse
		}},
	}, nil
}

func (d *resendDelivery) sendLoginLink(ctx context.Context, email, token string) error {
	link := d.origin
	link.Path = "/confirmar-acceso"
	link.Fragment = token
	expiry := fmt.Sprintf("vence en %d minutos y se puede usar una sola vez. Si no lo pediste, podés ignorar este correo.", int(linkLifetime.Minutes()))
	return d.sendMessage(ctx, []string{email}, "Tu enlace de acceso a Vitrina",
		"Ingresá a Vitrina con este enlace: "+link.String()+"\n\nEl enlace "+expiry,
		"<p><a href=\""+html.EscapeString(link.String())+"\">Ingresar a Vitrina</a></p><p>El enlace "+expiry+"</p>",
		"vitrina-login/"+tokenHash(token))
}

func (d *resendDelivery) send(ctx context.Context, to []string, subject, text, idempotencyKey string) error {
	body := "<p>" + strings.ReplaceAll(html.EscapeString(text), "\n", "<br>") + "</p>"
	return d.sendMessage(ctx, to, subject, text, body, idempotencyKey)
}

func (d *resendDelivery) sendMessage(ctx context.Context, to []string, subject, text, htmlBody, idempotencyKey string) error {
	if d.key == "" {
		log.Printf("Correo para %s — %s\n%s", strings.Join(to, ", "), subject, text)
		return nil
	}
	message := struct {
		From    string   `json:"from"`
		To      []string `json:"to"`
		Subject string   `json:"subject"`
		Text    string   `json:"text"`
		HTML    string   `json:"html"`
	}{From: d.from, To: to, Subject: subject, Text: text, HTML: htmlBody}
	body, err := json.Marshal(message)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+d.key)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotency-Key", idempotencyKey)
	res, err := d.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("Resend respondió con HTTP %d", res.StatusCode)
	}
	return nil
}
