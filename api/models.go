package main

import (
	"time"
	_ "time/tzdata"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Every shop keeps its agenda in El Salvador time; the web shows the same zone.
var shopZone = func() *time.Location {
	zone, err := time.LoadLocation("America/El_Salvador")
	if err != nil {
		panic(err)
	}
	return zone
}()

// localMinute is how shop-local times travel to and from the web.
const localMinute = "2006-01-02T15:04"

type option struct {
	Name   string   `json:"name"`
	Values []string `json:"values"`
	// Prices holds an optional surcharge in cents per value, parallel to Values.
	Prices []int `json:"prices,omitempty"`
}
type product struct {
	ShopSlug    string   `json:"-" gorm:"primaryKey"`
	Slug        string   `json:"slug" gorm:"primaryKey"`
	Name        string   `json:"name"`
	Description string   `json:"description" gorm:"not null;default:''"`
	Category    string   `json:"category" gorm:"not null;default:''"`
	Badge       string   `json:"badge" gorm:"not null;default:''"`
	PriceCents  int      `json:"priceCents" gorm:"check:price_cents >= 0"`
	CompareAtCents int   `json:"compareAtCents" gorm:"not null;default:0;check:compare_at_cents >= 0"`
	Available       bool     `json:"available"`
	Stock           *int     `json:"stock"`
	Artwork         string   `json:"artwork"`
	Options     []option `json:"options" gorm:"serializer:json;type:jsonb"`
	Position    int      `json:"position"`
	Hidden      bool     `json:"hidden" gorm:"not null;default:false"`
	ImageURL    string   `json:"imageUrl"`
	// Gallery holds extra photos shown after ImageURL on the product page.
	Gallery         []string `json:"gallery" gorm:"serializer:json;type:jsonb;not null;default:'[]'"`
	Kind            string   `json:"kind" gorm:"not null;check:(kind = 'product' AND duration_minutes = 0) OR (kind = 'service' AND duration_minutes BETWEEN 1 AND 1440)"`
	DurationMinutes int      `json:"durationMinutes" gorm:"not null"`
}

func (p *product) AfterFind(*gorm.DB) error {
	if p.Options == nil {
		p.Options = []option{}
	}
	if p.Gallery == nil {
		p.Gallery = []string{}
	}
	return nil
}

// timeBlock is a single open–close interval within a day ("HH:MM").
type timeBlock struct {
	Open  string `json:"open"`
	Close string `json:"close"`
}

// dayHours is the opening window(s) for one weekday in the shop's time zone. Empty Open and Blocks means closed.
type dayHours struct {
	Open   string      `json:"open"`
	Close  string      `json:"close"`
	Blocks []timeBlock `json:"blocks,omitempty"`
}

func (d dayHours) intervals() []timeBlock {
	if len(d.Blocks) > 0 {
		return d.Blocks
	}
	if d.Open != "" && d.Close != "" {
		return []timeBlock{{Open: d.Open, Close: d.Close}}
	}
	return nil
}

// bookingConfig holds per-shop agenda rules and reminder settings.
type bookingConfig struct {
	BufferMinutes        int `json:"bufferMinutes,omitempty"`
	LeadTimeMinutes      int `json:"leadTimeMinutes,omitempty"`
	HorizonDays          int `json:"horizonDays,omitempty"`
	CancelNoticeHours    int `json:"cancelNoticeHours,omitempty"`
	ReminderHoursBefore  int `json:"reminderHoursBefore,omitempty"`
	Reminder2HoursBefore int `json:"reminder2HoursBefore,omitempty"`
}

// staffMember represents a specialist, stylist, or station with an independent agenda.
type staffMember struct {
	ID           string     `json:"id"`
	Name         string     `json:"name"`
	Role         string     `json:"role,omitempty"`
	Active       bool       `json:"active"`
	ServiceSlugs []string   `json:"serviceSlugs,omitempty"`
	Hours        []dayHours `json:"hours,omitempty"`
}

func (m staffMember) offersService(serviceSlug string) bool {
	if len(m.ServiceSlugs) == 0 {
		return true
	}
	for _, slug := range m.ServiceSlugs {
		if slug == serviceSlug {
			return true
		}
	}
	return false
}

// shopStyle holds optional visual overrides applied on top of the selected theme.
type shopStyle struct {
	Font          string `json:"font,omitempty"`
	BgColor       string `json:"bgColor,omitempty"`
	SurfaceColor  string `json:"surfaceColor,omitempty"`
	InkColor      string `json:"inkColor,omitempty"`
	Radius        string `json:"radius,omitempty"`
	ButtonStyle   string `json:"buttonStyle,omitempty"`
	HeroLayout    string `json:"heroLayout,omitempty"`
	CatalogLayout string `json:"catalogLayout,omitempty"`
	CardAspect    string `json:"cardAspect,omitempty"`
	VeilOpacity   int    `json:"veilOpacity,omitempty"`
	Announcement  string `json:"announcement,omitempty"`
}

// deliveryConfig describes pickup and delivery options offered by a shop.
type deliveryConfig struct {
	PickupEnabled    bool   `json:"pickupEnabled"`
	PickupNote       string `json:"pickupNote,omitempty"`
	DeliveryEnabled  bool   `json:"deliveryEnabled"`
	DeliveryFeeMode  string `json:"deliveryFeeMode,omitempty"` // "" | "free" | "fixed" | "coordinate"
	DeliveryFeeCents int    `json:"deliveryFeeCents,omitempty"`
	DeliveryNote     string `json:"deliveryNote,omitempty"`
}

// shopPolicies holds optional storefront policies (shipping, returns, booking cancellation).
type shopPolicies struct {
	Shipping     string `json:"shipping,omitempty"`
	Returns      string `json:"returns,omitempty"`
	Cancellation string `json:"cancellation,omitempty"`
}

// shopFAQ is a single frequently asked question displayed on the storefront.
type shopFAQ struct {
	Question string `json:"question"`
	Answer   string `json:"answer"`
}

type shop struct {
	Slug           string         `json:"slug" gorm:"primaryKey"`
	Name           string         `json:"name"`
	Description    string         `json:"description"`
	Theme          string         `json:"theme"`
	AccentColor    string         `json:"accentColor"`
	Locale         string         `json:"locale" gorm:"not null;default:''"`
	Timezone       string         `json:"timezone" gorm:"not null;default:'America/El_Salvador'"`
	Currency       string         `json:"currency" gorm:"not null;default:'USD'"`
	Style          shopStyle      `json:"style" gorm:"serializer:json;type:jsonb;not null;default:'{}'"`
	Delivery       deliveryConfig `json:"delivery" gorm:"serializer:json;type:jsonb;not null;default:'{}'"`
	PaymentMethods []string       `json:"paymentMethods" gorm:"serializer:json;type:jsonb;not null;default:'[]'"`
	Policies       shopPolicies   `json:"policies" gorm:"serializer:json;type:jsonb;not null;default:'{}'"`
	FAQs           []shopFAQ      `json:"faqs" gorm:"serializer:json;type:jsonb;not null;default:'[]'"`
	LogoURL        string         `json:"logoUrl"`
	BackgroundURL  string         `json:"backgroundUrl"`
	Instagram      string         `json:"instagram"`
	TikTok         string         `json:"tiktok" gorm:"column:tiktok"`
	Facebook       string         `json:"facebook" gorm:"not null;default:''"`
	Website        string         `json:"website" gorm:"not null;default:''"`
	Address        string         `json:"address" gorm:"not null;default:''"`
	MapURL         string         `json:"mapUrl" gorm:"not null;default:''"`
	Whatsapp       string         `json:"whatsapp"`
	// Hours holds seven entries indexed by time.Weekday (Sunday first). Empty disables online booking.
	Hours         []dayHours    `json:"hours" gorm:"serializer:json;type:jsonb;not null;default:'[]'"`
	BlockedDates  []string      `json:"blockedDates" gorm:"serializer:json;type:jsonb;not null;default:'[]'"`
	BookingConfig bookingConfig `json:"bookingConfig" gorm:"serializer:json;type:jsonb;not null;default:'{}'"`
	Staff         []staffMember `json:"staff" gorm:"serializer:json;type:jsonb;not null;default:'[]'"`
	Products      []product     `json:"products" gorm:"foreignKey:ShopSlug;references:Slug"`
}

func (s shop) location() *time.Location {
	if s.Timezone != "" {
		if loc, err := time.LoadLocation(s.Timezone); err == nil {
			return loc
		}
	}
	return shopZone
}

func (s shop) bookingBuffer() time.Duration {
	if s.BookingConfig.BufferMinutes > 0 {
		return time.Duration(s.BookingConfig.BufferMinutes) * time.Minute
	}
	return 0
}

func (s shop) bookingLeadTime() time.Duration {
	if s.BookingConfig.LeadTimeMinutes > 0 {
		return time.Duration(s.BookingConfig.LeadTimeMinutes) * time.Minute
	}
	return bookingLeadTime
}

func (s shop) bookingHorizonDays() int {
	if s.BookingConfig.HorizonDays > 0 {
		return s.BookingConfig.HorizonDays
	}
	return bookingHorizonDays
}

func (s shop) cancelNotice() time.Duration {
	if s.BookingConfig.CancelNoticeHours > 0 {
		return time.Duration(s.BookingConfig.CancelNoticeHours) * time.Hour
	}
	return 0
}

func (s shop) activeStaffForService(serviceSlug string) []staffMember {
	var out []staffMember
	for _, m := range s.Staff {
		if m.Active && m.offersService(serviceSlug) {
			out = append(out, m)
		}
	}
	return out
}

func (s shop) findStaff(id string) (staffMember, bool) {
	for _, m := range s.Staff {
		if m.ID == id {
			return m, true
		}
	}
	return staffMember{}, false
}

func (s shop) staffName(id string) string {
	if id == "" {
		return ""
	}
	if m, ok := s.findStaff(id); ok {
		return m.Name
	}
	return ""
}

func (s *shop) AfterFind(*gorm.DB) error {
	if s.Hours == nil {
		s.Hours = []dayHours{}
	}
	if s.BlockedDates == nil {
		s.BlockedDates = []string{}
	}
	if s.Staff == nil {
		s.Staff = []staffMember{}
	}
	if s.PaymentMethods == nil {
		s.PaymentMethods = []string{}
	}
	if s.FAQs == nil {
		s.FAQs = []shopFAQ{}
	}
	if s.Products == nil {
		s.Products = []product{}
	}
	if s.Timezone == "" {
		s.Timezone = "America/El_Salvador"
	}
	if s.Currency == "" {
		s.Currency = "USD"
	}
	return nil
}

type reservation struct {
	ID              uint    `gorm:"primaryKey"`
	ShopSlug        string  `gorm:"index:agenda,priority:1;not null"`
	ServiceSlug     string  `gorm:"not null"`
	Service         product `gorm:"foreignKey:ShopSlug,ServiceSlug;references:ShopSlug,Slug"`
	StaffID         string  `gorm:"index:agenda_staff,priority:2;not null;default:''"`
	Customer        string  `gorm:"not null"`
	Phone           string  `gorm:"not null;default:''"`
	Email           string  `gorm:"not null;default:''"`
	Notes           string  `gorm:"not null;default:''"`
	Source          string  `gorm:"not null;default:'panel'"`
	ManageToken     *string `gorm:"uniqueIndex"`
	Reminder1SentAt *time.Time
	Reminder2SentAt *time.Time
	CreatedAt       time.Time
	StartsAt        time.Time `gorm:"index:agenda,priority:2;not null"`
	CancelledAt     *time.Time
	EndsAt          time.Time `gorm:"not null;check:ends_at > starts_at"`
}

func seed(db *gorm.DB) error {
	sizes := option{Name: "Tamaño", Values: []string{"A4", "A3"}}
	shops := []shop{
		{Slug: "marea-estudio", Name: "Marea Estudio", Description: "Láminas de autor impresas en San Salvador.", Theme: "costa", Instagram: "marea.estudio", TikTok: "marea.prints"},
		{Slug: "luna-unas", Name: "Luna Uñas", Description: "Manicura y cuidado de uñas con cita previa.", Theme: "arena", Hours: []dayHours{{}, {}, {Open: "09:00", Close: "18:00"}, {Open: "09:00", Close: "18:00"}, {Open: "09:00", Close: "18:00"}, {Open: "09:00", Close: "18:00"}, {Open: "09:00", Close: "14:00"}}},
	}
	items := []product{
		{ShopSlug: "marea-estudio", Slug: "sol-de-tarde", Name: "Sol de tarde", Kind: "product", PriceCents: 1800, Available: true, Artwork: "sol-de-tarde", Options: []option{sizes, {Name: "Tipo de papel", Values: []string{"Mate", "Satinado"}}}, Position: 1},
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
