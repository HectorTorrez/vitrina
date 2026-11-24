import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export type Locale = "es" | "en";

const LOCALE_COOKIE = "vitrina_locale";

export function parseLocale(value?: string | null): Locale | null {
  if (!value) return null;
  const clean = value.trim().toLowerCase();
  if (clean === "en" || clean.startsWith("en-") || clean.startsWith("en_")) return "en";
  if (clean === "es" || clean.startsWith("es-") || clean.startsWith("es_")) return "es";
  return null;
}

function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export const getInitialLocale = createServerFn({ method: "GET" }).handler(async (): Promise<Locale> => {
  const req = getRequest();
  if (req?.url) {
    const pathname = new URL(req.url).pathname;
    if (pathname === "/en" || pathname === "/en/") return "en";
    if (pathname === "/") return "es";
  }
  const fromCookie = parseLocale(readCookie(req?.headers.get("cookie") ?? null, LOCALE_COOKIE));
  if (fromCookie) return fromCookie;
  const accept = req?.headers.get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const parsed = parseLocale(part.split(";")[0]);
    if (parsed) return parsed;
  }
  return "es";
});

export function writeLocaleCookie(locale: Locale) {
  if (typeof document === "undefined") return;
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  document.documentElement.lang = locale === "en" ? "en" : "es-SV";
}

export const messages = {
  es: {
    // Common
    "common.back": "Atrás",
    "common.cancel": "Cancelar",
    "common.continue": "Continuar",
    "common.save": "Guardar cambios",
    "common.saving": "Guardando…",
    "common.discard": "Descartar",
    "common.edit": "Editar",
    "common.delete": "Eliminar",
    "common.copy": "Copiar",
    "common.copied": "Copiado",
    "common.open": "Abrir",
    "common.optional": "(opcional)",
    "common.suggest": "Sugerir",
    "common.retry": "Reintentar",
    "common.backHome": "Volver al inicio",
    "common.notFoundTitle": "Página no encontrada",
    "common.notFoundDesc": "El enlace no existe o la ficha ya no está publicada.",
    "common.errorTitle": "Algo salió mal",
    "common.errorDesc": "No pudimos cargar esta página. Probá de nuevo en un momento.",
    "common.unsavedChanges": "Tenés cambios sin guardar",
    "common.changesSaved": "Cambios guardados",
    "common.couldNotSave": "No se pudo guardar",
    "common.sessionExpired": "Tu sesión venció",
    "common.language": "Idioma",

    // Landing
    "landing.nav.features": "Funciones",
    "landing.nav.how": "Cómo funciona",
    "landing.nav.login": "Ingresar",
    "landing.nav.openShop": "Abrir mi tienda",
    "landing.hero.title1": "Tu negocio",
    "landing.hero.title2": "nunca cierra.",
    "landing.hero.desc": "Catálogo, citas en línea y WhatsApp en un solo enlace. Tus clientes ven precios, reservan y te escriben mientras vos atendés.",
    "landing.hero.cta": "Quiero mi vitrina",
    "landing.hero.viewShop": "Ver una tienda",
    "landing.hero.haveShop": "Ya tengo tienda",
    "landing.features.title1": "Todo lo que tu negocio necesita",
    "landing.features.title2": "para vender en línea.",
    "landing.features.booking.label": "Citas en línea",
    "landing.features.booking.title": "Tus clientes reservan solos, sin cruces.",
    "landing.features.booking.desc": "Horarios cada 15 minutos dentro de tu horario de atención. Cada reserva te llega al correo.",
    "landing.features.wa.title": "Te escriben desde la ficha.",
    "landing.features.wa.msg1": "Hola, ¿tienen espacio el jueves para manicura en gel?",
    "landing.features.wa.msg2": "¡Claro! Reservá aquí a las 10:30.",
    "landing.features.catalog.label": "Catálogo",
    "landing.features.catalog.title": "Variantes con su propio precio.",
    "landing.features.preview.label": "Vista previa",
    "landing.features.preview.title": "Se ve bien en cada chat.",
    "landing.features.local.title1": "Tu local, también",
    "landing.features.local.title2": "abierto en línea.",
    "landing.how.label": "Cómo funciona",
    "landing.how.title": "De cero a tu primera cita, en una tarde.",
    "landing.how.desc": "Sin apps que instalar ni contraseñas. Entrás con un enlace a tu correo.",
    "landing.how.step1.title": "Abrís tu tienda",
    "landing.how.step1.desc": "Elegís tu enlace, como /tienda/tu-negocio, y confirmás tu correo.",
    "landing.how.step2.title": "Cargás tu catálogo",
    "landing.how.step2.desc": "Fotos, precios, variantes y tu horario de atención, desde el celular.",
    "landing.how.step3.title": "Compartís el enlace",
    "landing.how.step3.desc": "En tu bio y tus estados. Las reservas caen solas en tu agenda.",
    "landing.cta.title1": "Abrí tu vitrina",
    "landing.cta.title2": "esta semana.",
    "landing.cta.btn": "Crear mi tienda",
    "landing.footer.tagline": "Catálogos y citas para negocios en línea",
    "landing.footer.sellerAccess": "Acceso para vendedores",

    // Auth
    "auth.perk1": "Tu catálogo, tu agenda y tus citas en un solo lugar.",
    "auth.perk2": "Entrás sin contraseña, con un enlace a tu correo.",
    "auth.perk3": "Funciona igual desde el celular.",
    "auth.login.eyebrow": "Acceso para vendedores",
    "auth.login.title": "Entrá a tu vitrina",
    "auth.login.lede": "Te enviamos un enlace a tu correo para entrar. Sin contraseñas.",
    "auth.login.emailLabel": "Correo electrónico",
    "auth.login.submit": "Enviarme un enlace",
    "auth.login.sending": "Enviando…",
    "auth.login.switch": "¿Todavía no tenés tienda?",
    "auth.login.switchLink": "Abrí tu vitrina",
    "auth.login.sentEyebrow": "Enlace enviado",
    "auth.login.sentTitle": "Revisá tu correo",
    "auth.login.sentLede": "Si tu correo está habilitado, te llegó un enlace para entrar. Revisá también la carpeta de spam.",
    "auth.login.sentNote": "El enlace vence en 15 minutos y sirve una sola vez.",
    "auth.login.otherEmail": "Usar otro correo",
    "auth.login.errEmail": "Ingresá un correo electrónico válido.",
    "auth.login.errLink": "El enlace venció, ya se usó o es inválido. Pedí otro para ingresar.",
    "auth.login.errService": "No se pudo procesar la solicitud. Intentá de nuevo en unos minutos.",
    "auth.signup.step1": "Tu negocio",
    "auth.signup.step2": "Tu correo",
    "auth.signup.title1": "Tu vitrina, lista hoy",
    "auth.signup.title2": "¿A dónde te escribimos?",
    "auth.signup.lede1": "Contanos cómo se llama tu negocio. Después cargás tu catálogo y tu horario desde el panel.",
    "auth.signup.lede2": "Te mandamos un enlace para confirmar. Sin contraseñas.",
    "auth.signup.shopName": "Nombre del negocio",
    "auth.signup.shopSlug": "Enlace de tu tienda",
    "auth.signup.yourEmail": "Tu correo",
    "auth.signup.create": "Crear mi tienda",
    "auth.signup.creating": "Creando…",
    "auth.signup.switch": "¿Ya tenés tienda?",
    "auth.signup.switchLink": "Ingresá",
    "auth.signup.sentEyebrow": "Último paso",
    "auth.signup.sentTitle": "Confirmá tu correo",
    "auth.signup.sentLede": "Te enviamos un enlace. Al abrirlo se crea tu tienda y entrás directo a tu panel. Revisá también la carpeta de spam.",
    "auth.signup.startOver": "Empezar de nuevo",
    "auth.signup.errTaken": "Ese enlace ya lo usa otra tienda. Probá con otro.",
    "auth.signup.errData": "Revisá los datos: el nombre, el enlace (solo minúsculas, números y guiones) y el correo.",
    "auth.signup.nameRequired": "Contanos cómo se llama tu negocio.",
    "auth.signup.tryWith": "Probá con:",
    "auth.confirm.eyebrow": "Último paso",
    "auth.confirm.title": "Ya casi estás adentro",
    "auth.confirm.lede": "Confirmá para entrar al panel de tu tienda desde este dispositivo.",
    "auth.confirm.submit": "Entrar al panel",
    "auth.confirm.entering": "Entrando…",
    "auth.confirm.note": "¿El enlace no funciona?",
    "auth.confirm.requestNew": "Pedí otro",

    // Storefront
    "store.writeUs": "Escribinos",
    "store.madeWith": "Hecho con",
    "store.sellerAccess": "Acceso para vendedores",
    "store.onlineBookings": "Reservas en línea",
    "store.unavailable": "No disponible",
    "store.unavailableNow": "No disponible por ahora",
    "store.from": "Desde",
    "store.catalog": "Catálogo",
    "store.filterAll": "Todo",
    "store.filterServices": "Servicios",
    "store.filterProducts": "Productos",
    "store.optionSingular": "opción",
    "store.optionPlural": "opciones",
    "store.searchPlaceholder": "Buscar en el catálogo",
    "store.clearSearch": "Limpiar búsqueda",
    "store.noResults": "Sin resultados",
    "store.noResultsDesc": "Probá con otra búsqueda o filtro.",
    "store.comingSoon": "Muy pronto",
    "store.comingSoonDesc": "Esta tienda todavía está preparando su catálogo.",
    "store.share": "Compartir",
    "store.linkCopied": "Enlace copiado",
    "store.service": "Servicio",
    "store.product": "Producto",
    "store.confirmByWa": "El negocio confirma tu cita por WhatsApp.",
    "store.askWaBooking": "¿Dudas? Consultá por WhatsApp",
    "store.askWaHours": "Consultar horarios por WhatsApp",
    "store.orderWa": "Pedir por WhatsApp",
    "store.prepareInquiry": "Preparar consulta",
    "store.prepareOrder": "Preparar pedido",
    "store.sampleMsg": "Mensaje · tienda de muestra",
    "store.optionUnavailable": "Esta opción no está disponible por ahora.",
    "store.alsoLike": "También te puede interesar",
    "store.waHelloService": "Hola, quisiera consultar horarios para ",
    "store.waHelloProduct": "Hola, quisiera pedir ",
    "store.yourShop": "Tu tienda",

    // Booking
    "booking.title": "Reservar cita",
    "booking.otherDate": "Otra fecha",
    "booking.today": "hoy",
    "booking.morning": "Mañana",
    "booking.afternoon": "Tarde",
    "booking.evening": "Noche",
    "booking.noSlots": "No hay horarios libres ese día. Probá con otra fecha.",
    "booking.nameLabel": "Nombre",
    "booking.namePlaceholder": "¿A nombre de quién?",
    "booking.nameError": "Escribí tu nombre.",
    "booking.phoneLabel": "WhatsApp o teléfono",
    "booking.phoneError": "Escribí un número de al menos 8 dígitos.",
    "booking.submitAt": "Reservar a las",
    "booking.booking": "Reservando…",
    "booking.confirmedTitle": "¡Cita reservada!",
    "booking.confirmedDesc": "El negocio recibió tu reserva. Si necesitás cambiarla, escribiles directamente.",
    "booking.errLoad": "No se pudo consultar la agenda",
    "booking.errSubmit": "No se pudo reservar. Intentá de nuevo.",

    // Panel
    "panel.nav.home": "Inicio",
    "panel.nav.catalog": "Catálogo",
    "panel.nav.agenda": "Agenda",
    "panel.nav.shop": "Mi tienda",
    "panel.nav.create": "Alta de tiendas",
    "panel.viewShop": "Ver mi tienda",
    "panel.viewShopShort": "Ver tienda",
    "panel.logout": "Cerrar sesión",
    "panel.backToPanel": "Volver al panel",
    "panel.expandSidebar": "Ampliar menú lateral",
    "panel.collapseSidebar": "Reducir menú lateral",
    "panel.overview.eyebrow": "Tu tienda",
    "panel.overview.published": "Fichas publicadas",
    "panel.overview.hiddenCount": "ocultas",
    "panel.overview.upcoming": "Citas próximas",
    "panel.overview.next": "Próxima:",
    "panel.overview.connected": "Conectado",
    "panel.overview.noNumber": "Sin número",
    "panel.overview.addInShop": "Agregalo en Mi tienda",
    "panel.overview.firstSteps": "Primeros pasos",
    "panel.overview.firstStepsDesc": "Completá estos pasos para que tu tienda esté lista para compartir.",
    "panel.overview.of": "de",
    "panel.overview.task1.title": "Publicá tu primera ficha",
    "panel.overview.task1.text": "Un producto o servicio con foto y precio.",
    "panel.overview.task1.cta": "Agregar ficha",
    "panel.overview.task2.title": "Contá de qué se trata",
    "panel.overview.task2.text": "Una descripción corta debajo del nombre.",
    "panel.overview.task2.cta": "Escribir",
    "panel.overview.task3.title": "Conectá tu WhatsApp",
    "panel.overview.task3.text": "Así te escriben desde cada ficha.",
    "panel.overview.task3.cta": "Agregar número",
    "panel.overview.task4.title": "Activá las reservas en línea",
    "panel.overview.task4.text": "Definí tu horario y recibí citas solas.",
    "panel.overview.task4.cta": "Configurar",
    "panel.overview.newItem": "Nueva ficha",
    "panel.overview.newItemDesc": "Agregá un producto o servicio.",
    "panel.overview.customize": "Personalizar tienda",
    "panel.overview.customizeDesc": "Tema, descripción, redes y horario.",

    // Panel Profile
    "profile.sectionLabel": "Mi tienda",
    "profile.sectionTitle": "Perfil público",
    "profile.sectionText": "Nombre, apariencia, contacto y horario. Mirá los cambios en vivo antes de guardar.",
    "profile.identity": "Identidad",
    "profile.identityDesc": "Lo primero que ven tus clientes al abrir tu enlace.",
    "profile.shopName": "Nombre de la tienda",
    "profile.description": "Descripción",
    "profile.descriptionHint": "Una o dos frases: qué ofrecés y dónde. Aparece debajo del nombre y al compartir el enlace.",
    "profile.storeLocale": "Idioma de la tienda",
    "profile.storeLocaleHint": "Idioma por defecto para quienes visitan tu tienda.",
    "profile.localeAuto": "Automático (según navegador)",
    "profile.localeEs": "Español",
    "profile.localeEn": "English",
    "profile.appearance": "Apariencia",
    "profile.theme": "Tema",
    "profile.themeDesc": "Fondo, tipografía y colores base de tu tienda.",
    "profile.accent": "Color principal",
    "profile.accentDesc": "Botones, precios destacados y filtros seleccionados.",
    "profile.fromTheme": "Del tema",
    "profile.pickOtherColor": "Elegir otro color",
    "profile.images": "Logo e imagen de fondo",
    "profile.imagesDesc": "Opcionales · JPG, PNG, WebP o GIF hasta 5 MB.",
    "profile.logo": "Logo",
    "profile.logoHint": "Cuadrado, se muestra en círculo.",
    "profile.background": "Imagen de fondo",
    "profile.backgroundHint": "Horizontal, va detrás de tu tienda.",
    "profile.contact": "Contacto y redes",
    "profile.contactDesc": "Aparecen como botones en tu tienda.",
    "profile.whatsappHint": "Tus clientes pueden escribirte a este número desde cada ficha.",
    "profile.onlineBooking": "Reservas en línea",
    "profile.acceptBooking": "Aceptar reservas en línea",
    "profile.acceptBookingDesc": "Tus clientes eligen fecha y hora desde la ficha de cada servicio.",
    "profile.hoursHint": "Horario de atención (hora de El Salvador). Turnos cada 15 min.",
    "profile.copyDay": "Copiar",
    "profile.toAll": "a todos",
    "profile.closed": "Cerrado",
    "profile.to": "a",
    "profile.updated": "Tienda actualizada",
    "profile.preview": "Vista previa",
    "profile.phone": "Celular",
    "profile.desktop": "Computadora",

    // Panel Catalog
    "catalog.title": "Productos y servicios",
    "catalog.text": "El orden de esta lista es el de tu tienda. Cambialo con las flechas o desde el menú ···.",
    "catalog.newItem": "Nueva ficha",
    "catalog.filterAll": "Todas",
    "catalog.filterHidden": "Ocultas",
    "catalog.search": "Buscar ficha",
    "catalog.emptyTitle": "Tu catálogo está vacío",
    "catalog.emptyDesc": "Agregá tu primer producto o servicio. Toma menos de un minuto.",
    "catalog.createFirst": "Crear mi primera ficha",
    "catalog.noMatch": "Ninguna ficha coincide con la búsqueda.",
    "catalog.hidden": "Oculta",
    "catalog.variantSingular": "variante",
    "catalog.variantPlural": "variantes",
    "catalog.viewInShop": "Ver en la tienda",
    "catalog.showInShop": "Mostrar en la tienda",
    "catalog.hideFromShop": "Ocultar de la tienda",
    "catalog.duplicate": "Duplicar",
    "catalog.moveUp": "Subir",
    "catalog.moveDown": "Bajar",
    "catalog.deleteTitle": "¿Eliminar",
    "catalog.deleteDesc": "La ficha y su enlace dejarán de existir. Si solo querés retirarla un tiempo, ocultala.",
    "catalog.hide": "Ocultar",

    // Panel Agenda
    "agenda.title": "Citas",
    "agenda.schedule": "Agendar cita",
    "agenda.needService": "Publicá un servicio disponible para agendar nuevas citas.",
    "agenda.upcoming": "Próximas citas",
    "agenda.noUpcoming": "No hay citas próximas.",
    "agenda.online": "En línea",
    "agenda.history": "Historial",
    "agenda.cancelled": "Cancelada",
    "agenda.cancelBooking": "Cancelar cita",
    "agenda.cancelDesc": "El horario volverá a quedar libre.",
    "agenda.service": "Servicio",
    "agenda.chooseService": "Elegí un servicio",
    "agenda.customer": "Cliente",
    "agenda.phoneOptional": "Teléfono (opcional)",
    "agenda.dateTime": "Fecha y hora",
    "agenda.confirm": "Confirmar cita",
    "agenda.saveChanges": "Guardar cambios de la cita",
    "agenda.writeWa": "Escribir por WhatsApp",
  },
  en: {
    // Common
    "common.back": "Back",
    "common.cancel": "Cancel",
    "common.continue": "Continue",
    "common.save": "Save changes",
    "common.saving": "Saving…",
    "common.discard": "Discard",
    "common.edit": "Edit",
    "common.delete": "Delete",
    "common.copy": "Copy",
    "common.copied": "Copied",
    "common.open": "Open",
    "common.optional": "(optional)",
    "common.suggest": "Suggest",
    "common.retry": "Try again",
    "common.backHome": "Back to home",
    "common.notFoundTitle": "Page not found",
    "common.notFoundDesc": "This link does not exist or the item is no longer published.",
    "common.errorTitle": "Something went wrong",
    "common.errorDesc": "We couldn't load this page. Please try again in a moment.",
    "common.unsavedChanges": "You have unsaved changes",
    "common.changesSaved": "Changes saved",
    "common.couldNotSave": "Could not save",
    "common.sessionExpired": "Your session expired",
    "common.language": "Language",

    // Landing
    "landing.nav.features": "Features",
    "landing.nav.how": "How it works",
    "landing.nav.login": "Sign in",
    "landing.nav.openShop": "Open my shop",
    "landing.hero.title1": "Your business",
    "landing.hero.title2": "never closes.",
    "landing.hero.desc": "Catalog, online bookings, and WhatsApp in a single link. Customers browse prices, book appointments, and message you while you work.",
    "landing.hero.cta": "Get my storefront",
    "landing.hero.viewShop": "View a shop",
    "landing.hero.haveShop": "I already have a shop",
    "landing.features.title1": "Everything your business needs",
    "landing.features.title2": "to sell online.",
    "landing.features.booking.label": "Online bookings",
    "landing.features.booking.title": "Customers book on their own, with zero overlaps.",
    "landing.features.booking.desc": "Slots every 15 minutes within your business hours. Every booking arrives straight to your email.",
    "landing.features.wa.title": "They message you right from the item.",
    "landing.features.wa.msg1": "Hi! Do you have an opening Thursday for a gel manicure?",
    "landing.features.wa.msg2": "Sure! Book here at 10:30.",
    "landing.features.catalog.label": "Catalog",
    "landing.features.catalog.title": "Variants with their own pricing.",
    "landing.features.preview.label": "Link previews",
    "landing.features.preview.title": "Looks great in every chat.",
    "landing.features.local.title1": "Your shop, now",
    "landing.features.local.title2": "open online too.",
    "landing.how.label": "How it works",
    "landing.how.title": "From zero to your first booking, in an afternoon.",
    "landing.how.desc": "No apps to install and no passwords. Sign in with a link sent to your email.",
    "landing.how.step1.title": "Open your shop",
    "landing.how.step1.desc": "Pick your link, like /tienda/your-shop, and confirm your email.",
    "landing.how.step2.title": "Add your catalog",
    "landing.how.step2.desc": "Photos, prices, variants, and business hours right from your phone.",
    "landing.how.step3.title": "Share your link",
    "landing.how.step3.desc": "In your bio and stories. Bookings land directly in your schedule.",
    "landing.cta.title1": "Launch your storefront",
    "landing.cta.title2": "this week.",
    "landing.cta.btn": "Create my shop",
    "landing.footer.tagline": "Online catalogs and bookings for local businesses",
    "landing.footer.sellerAccess": "Seller sign in",

    // Auth
    "auth.perk1": "Your catalog, schedule, and bookings in one place.",
    "auth.perk2": "Passwordless sign-in with an email link.",
    "auth.perk3": "Works seamlessly on mobile.",
    "auth.login.eyebrow": "Seller access",
    "auth.login.title": "Sign in to your shop",
    "auth.login.lede": "We'll send a sign-in link to your email. No passwords needed.",
    "auth.login.emailLabel": "Email address",
    "auth.login.submit": "Send me a link",
    "auth.login.sending": "Sending…",
    "auth.login.switch": "Don't have a shop yet?",
    "auth.login.switchLink": "Open your storefront",
    "auth.login.sentEyebrow": "Link sent",
    "auth.login.sentTitle": "Check your inbox",
    "auth.login.sentLede": "If your email is registered, we sent you a sign-in link. Check your spam folder too.",
    "auth.login.sentNote": "The link expires in 15 minutes and can only be used once.",
    "auth.login.otherEmail": "Use another email",
    "auth.login.errEmail": "Please enter a valid email address.",
    "auth.login.errLink": "This link expired, was already used, or is invalid. Request a new one.",
    "auth.login.errService": "Could not process your request. Please try again in a few minutes.",
    "auth.signup.step1": "Your business",
    "auth.signup.step2": "Your email",
    "auth.signup.title1": "Your storefront, ready today",
    "auth.signup.title2": "Where should we email you?",
    "auth.signup.lede1": "Tell us your business name. You can add your catalog and hours later from the panel.",
    "auth.signup.lede2": "We'll send a confirmation link. No passwords.",
    "auth.signup.shopName": "Business name",
    "auth.signup.shopSlug": "Your shop link",
    "auth.signup.yourEmail": "Your email",
    "auth.signup.create": "Create my shop",
    "auth.signup.creating": "Creating…",
    "auth.signup.switch": "Already have a shop?",
    "auth.signup.switchLink": "Sign in",
    "auth.signup.sentEyebrow": "Last step",
    "auth.signup.sentTitle": "Confirm your email",
    "auth.signup.sentLede": "We sent you a link. Opening it creates your shop and signs you right into your panel. Check spam too.",
    "auth.signup.startOver": "Start over",
    "auth.signup.errTaken": "That link is already taken by another shop. Try another one.",
    "auth.signup.errData": "Check your details: name, link (lowercase letters, numbers, and hyphens only), and email.",
    "auth.signup.nameRequired": "Tell us your business name.",
    "auth.signup.tryWith": "Try:",
    "auth.confirm.eyebrow": "Last step",
    "auth.confirm.title": "You're almost in",
    "auth.confirm.lede": "Confirm to enter your shop panel on this device.",
    "auth.confirm.submit": "Enter panel",
    "auth.confirm.entering": "Signing in…",
    "auth.confirm.note": "Link not working?",
    "auth.confirm.requestNew": "Request a new one",

    // Storefront
    "store.writeUs": "Message us",
    "store.madeWith": "Made with",
    "store.sellerAccess": "Seller sign in",
    "store.onlineBookings": "Online bookings",
    "store.unavailable": "Unavailable",
    "store.unavailableNow": "Currently unavailable",
    "store.from": "From",
    "store.catalog": "Catalog",
    "store.filterAll": "All",
    "store.filterServices": "Services",
    "store.filterProducts": "Products",
    "store.optionSingular": "item",
    "store.optionPlural": "items",
    "store.searchPlaceholder": "Search catalog",
    "store.clearSearch": "Clear search",
    "store.noResults": "No results",
    "store.noResultsDesc": "Try another search or filter.",
    "store.comingSoon": "Coming soon",
    "store.comingSoonDesc": "This shop is still preparing its catalog.",
    "store.share": "Share",
    "store.linkCopied": "Link copied",
    "store.service": "Service",
    "store.product": "Product",
    "store.confirmByWa": "The business confirms your appointment via WhatsApp.",
    "store.askWaBooking": "Questions? Ask on WhatsApp",
    "store.askWaHours": "Ask about availability on WhatsApp",
    "store.orderWa": "Order via WhatsApp",
    "store.prepareInquiry": "Prepare inquiry",
    "store.prepareOrder": "Prepare order",
    "store.sampleMsg": "Message · sample shop",
    "store.optionUnavailable": "This item is currently unavailable.",
    "store.alsoLike": "You might also like",
    "store.waHelloService": "Hi, I'd like to ask about availability for ",
    "store.waHelloProduct": "Hi, I'd like to order ",
    "store.yourShop": "Your shop",

    // Booking
    "booking.title": "Book appointment",
    "booking.otherDate": "Other date",
    "booking.today": "today",
    "booking.morning": "Morning",
    "booking.afternoon": "Afternoon",
    "booking.evening": "Evening",
    "booking.noSlots": "No open slots on this day. Try another date.",
    "booking.nameLabel": "Name",
    "booking.namePlaceholder": "Your full name",
    "booking.nameError": "Please enter your name.",
    "booking.phoneLabel": "WhatsApp or phone",
    "booking.phoneError": "Please enter at least 8 digits.",
    "booking.submitAt": "Book at",
    "booking.booking": "Booking…",
    "booking.confirmedTitle": "Appointment booked!",
    "booking.confirmedDesc": "The business received your booking. If you need to change it, message them directly.",
    "booking.errLoad": "Could not load available times",
    "booking.errSubmit": "Could not complete booking. Please try again.",

    // Panel
    "panel.nav.home": "Home",
    "panel.nav.catalog": "Catalog",
    "panel.nav.agenda": "Schedule",
    "panel.nav.shop": "My shop",
    "panel.nav.create": "New shop",
    "panel.viewShop": "View my shop",
    "panel.viewShopShort": "View shop",
    "panel.logout": "Sign out",
    "panel.backToPanel": "Back to panel",
    "panel.expandSidebar": "Expand sidebar",
    "panel.collapseSidebar": "Collapse sidebar",
    "panel.overview.eyebrow": "Your shop",
    "panel.overview.published": "Published items",
    "panel.overview.hiddenCount": "hidden",
    "panel.overview.upcoming": "Upcoming bookings",
    "panel.overview.next": "Next:",
    "panel.overview.connected": "Connected",
    "panel.overview.noNumber": "No number",
    "panel.overview.addInShop": "Add it in My shop",
    "panel.overview.firstSteps": "Getting started",
    "panel.overview.firstStepsDesc": "Complete these steps so your shop is ready to share.",
    "panel.overview.of": "of",
    "panel.overview.task1.title": "Publish your first item",
    "panel.overview.task1.text": "A product or service with a photo and price.",
    "panel.overview.task1.cta": "Add item",
    "panel.overview.task2.title": "Tell people what you offer",
    "panel.overview.task2.text": "A short description below your shop name.",
    "panel.overview.task2.cta": "Write",
    "panel.overview.task3.title": "Connect your WhatsApp",
    "panel.overview.task3.text": "So customers can message you from every item.",
    "panel.overview.task3.cta": "Add number",
    "panel.overview.task4.title": "Enable online bookings",
    "panel.overview.task4.text": "Set your hours and receive bookings automatically.",
    "panel.overview.task4.cta": "Configure",
    "panel.overview.newItem": "New item",
    "panel.overview.newItemDesc": "Add a product or service.",
    "panel.overview.customize": "Customize shop",
    "panel.overview.customizeDesc": "Theme, description, links, and hours.",

    // Panel Profile
    "profile.sectionLabel": "My shop",
    "profile.sectionTitle": "Public profile",
    "profile.sectionText": "Name, appearance, contact, and hours. Preview changes live before saving.",
    "profile.identity": "Identity",
    "profile.identityDesc": "The first thing customers see when opening your link.",
    "profile.shopName": "Shop name",
    "profile.description": "Description",
    "profile.descriptionHint": "One or two sentences: what you offer and where. Shown under your name and in link previews.",
    "profile.storeLocale": "Storefront language",
    "profile.storeLocaleHint": "Default language for visitors opening your shop.",
    "profile.localeAuto": "Automatic (visitor browser)",
    "profile.localeEs": "Español",
    "profile.localeEn": "English",
    "profile.appearance": "Appearance",
    "profile.theme": "Theme",
    "profile.themeDesc": "Background, typography, and base colors of your shop.",
    "profile.accent": "Accent color",
    "profile.accentDesc": "Buttons, highlighted prices, and active filters.",
    "profile.fromTheme": "Theme default",
    "profile.pickOtherColor": "Pick another color",
    "profile.images": "Logo & background image",
    "profile.imagesDesc": "Optional · JPG, PNG, WebP or GIF up to 5 MB.",
    "profile.logo": "Logo",
    "profile.logoHint": "Square, displayed as a circle.",
    "profile.background": "Background image",
    "profile.backgroundHint": "Landscape, shown behind your shop.",
    "profile.contact": "Contact & social",
    "profile.contactDesc": "Shown as buttons on your storefront.",
    "profile.whatsappHint": "Customers can message this number directly from each item.",
    "profile.onlineBooking": "Online bookings",
    "profile.acceptBooking": "Accept online bookings",
    "profile.acceptBookingDesc": "Customers pick a date and time from each service page.",
    "profile.hoursHint": "Business hours (El Salvador time). Slots every 15 min.",
    "profile.copyDay": "Copy",
    "profile.toAll": "to all",
    "profile.closed": "Closed",
    "profile.to": "to",
    "profile.updated": "Shop updated",
    "profile.preview": "Live preview",
    "profile.phone": "Mobile",
    "profile.desktop": "Desktop",

    // Panel Catalog
    "catalog.title": "Products & services",
    "catalog.text": "The order here matches your storefront. Change it with the arrows or the ··· menu.",
    "catalog.newItem": "New item",
    "catalog.filterAll": "All",
    "catalog.filterHidden": "Hidden",
    "catalog.search": "Search items",
    "catalog.emptyTitle": "Your catalog is empty",
    "catalog.emptyDesc": "Add your first product or service. It takes less than a minute.",
    "catalog.createFirst": "Create my first item",
    "catalog.noMatch": "No items match your search.",
    "catalog.hidden": "Hidden",
    "catalog.variantSingular": "variant",
    "catalog.variantPlural": "variants",
    "catalog.viewInShop": "View in shop",
    "catalog.showInShop": "Show in shop",
    "catalog.hideFromShop": "Hide from shop",
    "catalog.duplicate": "Duplicate",
    "catalog.moveUp": "Move up",
    "catalog.moveDown": "Move down",
    "catalog.deleteTitle": "Delete",
    "catalog.deleteDesc": "This item and its link will be removed. If you only want to pause it, hide it instead.",
    "catalog.hide": "Hide",

    // Panel Agenda
    "agenda.title": "Bookings",
    "agenda.schedule": "Add booking",
    "agenda.needService": "Publish an available service to schedule bookings.",
    "agenda.upcoming": "Upcoming bookings",
    "agenda.noUpcoming": "No upcoming bookings.",
    "agenda.online": "Online",
    "agenda.history": "History",
    "agenda.cancelled": "Cancelled",
    "agenda.cancelBooking": "Cancel booking",
    "agenda.cancelDesc": "The time slot will become available again.",
    "agenda.service": "Service",
    "agenda.chooseService": "Choose a service",
    "agenda.customer": "Customer",
    "agenda.phoneOptional": "Phone (optional)",
    "agenda.dateTime": "Date & time",
    "agenda.confirm": "Confirm booking",
    "agenda.saveChanges": "Save booking changes",
    "agenda.writeWa": "Message on WhatsApp",
  },
} as const;

export type MessageKey = keyof typeof messages.es;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "es",
  setLocale: () => {},
  t: (key) => messages.es[key],
});

export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  useEffect(() => {
    setLocaleState(initialLocale);
  }, [initialLocale]);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    writeLocaleCookie(next);
  };

  const t = (key: MessageKey) => messages[locale][key] ?? messages.es[key];

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

export function LanguageSwitcher({ variant = "dark", className, onSelect }: { variant?: "dark" | "light" | "store"; className?: string; onSelect?: (next: Locale) => void }) {
  const { locale, setLocale, t } = useI18n();
  const next: Locale = locale === "es" ? "en" : "es";
  return (
    <button
      type="button"
      onClick={() => {
        setLocale(next);
        onSelect?.(next);
      }}
      aria-label={`${t("common.language")}: ${locale.toUpperCase()} → ${next.toUpperCase()}`}
      title={locale === "es" ? "Switch to English" : "Cambiar a Español"}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 font-mono text-xs font-medium uppercase transition",
        variant === "dark" && "border border-white/15 bg-white/5 text-neutral-300 hover:bg-white/15 hover:text-white",
        variant === "light" && "border border-border bg-card text-foreground hover:bg-muted",
        variant === "store" && "h-9 border border-store-rule bg-store-surface/60 px-3 text-store-ink hover:border-store-ink",
        className,
      )}
    >
      <Globe className="size-3.5 opacity-75" />
      {locale}
    </button>
  );
}
