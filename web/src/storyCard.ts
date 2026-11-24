import QRCode from "qrcode";
import { hasSurcharges, isProductAvailable, price, productImage, type Product, type Shop } from "./catalog";
import type { Locale } from "./i18n";
import { getTheme, relativeLuminance } from "./themes";

export type StoryCardVariant = "theme" | "dark";

export interface StoryCardInput {
  shop: Pick<Shop, "slug" | "name" | "description" | "theme" | "accentColor" | "style" | "logoUrl" | "currency" | "instagram" | "whatsapp" | "products">;
  product?: Product;
  url: string;
  locale: Locale;
  variant?: StoryCardVariant;
}

const WIDTH = 1080;
const HEIGHT = 1920;

interface Palette {
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  rule: string;
  accent: string;
  accentInk: string;
  soft: string;
  displayFont: string;
}

function contrasting(hex: string) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return "#ffffff";
  const lum = relativeLuminance(hex);
  return (lum + 0.05) / 0.05 >= 1.05 / (lum + 0.05) ? "#000000" : "#ffffff";
}

function resolvePalette(shop: StoryCardInput["shop"], variant: StoryCardVariant): Palette {
  const theme = getTheme(shop.theme);
  const displayFont = theme.display === "serif"
    ? 'Georgia, "Times New Roman", serif'
    : 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const accent = shop.accentColor || theme.colors.accent;
  const accentInk = shop.accentColor ? contrasting(shop.accentColor) : theme.colors.accentInk;

  if (variant === "dark") {
    return {
      bg: "#121217",
      surface: "#1d1d26",
      ink: "#f6f5f9",
      muted: "#a5a3b3",
      rule: "#2f2f3d",
      accent,
      accentInk,
      soft: "#262632",
      displayFont,
    };
  }

  return {
    bg: shop.style?.bgColor || theme.colors.bg,
    surface: shop.style?.surfaceColor || theme.colors.surface,
    ink: shop.style?.inkColor || theme.colors.ink,
    muted: theme.colors.muted,
    rule: theme.colors.rule,
    accent,
    accentInk,
    soft: theme.colors.soft,
    displayFont,
  };
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = window.setTimeout(() => resolve(null), 6000);
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, r: number) {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  const imgRatio = img.naturalWidth / Math.max(1, img.naturalHeight);
  const boxRatio = w / h;
  let drawW = w;
  let drawH = h;
  let offsetX = x;
  let offsetY = y;
  if (imgRatio > boxRatio) {
    drawW = h * imgRatio;
    offsetX = x - (drawW - w) / 2;
  } else {
    drawH = w / imgRatio;
    offsetY = y - (drawH - h) / 2;
  }
  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  ctx.restore();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = "";
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) {
        const rest = [current, ...words.slice(i + 1)].join(" ");
        let trimmed = rest;
        while (trimmed.length > 1 && ctx.measureText(trimmed + "…").width > maxWidth) {
          trimmed = trimmed.slice(0, -1).trimEnd();
        }
        lines.push(trimmed === rest ? rest : `${trimmed}…`);
        return lines;
      }
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement | null,
  name: string,
  cx: number,
  cy: number,
  size: number,
  palette: Palette,
) {
  const r = size / 2;
  if (logo) {
    drawCover(ctx, logo, cx - r, cy - r, size, size, r);
    ctx.save();
    ctx.strokeStyle = palette.rule;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.fillStyle = palette.accent;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "V";
  ctx.fillStyle = palette.accentInk;
  ctx.font = `700 ${Math.round(size * 0.4)}px ${palette.displayFont}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initials, cx, cy + 2);
  ctx.restore();
}

function formatDisplayUrl(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

export async function renderStoryCard({ shop, product, url, locale, variant = "theme" }: StoryCardInput): Promise<string> {
  const en = locale === "en";
  const palette = resolvePalette(shop, variant);
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const sans = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  // Background fill + subtle accent glow
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  ctx.globalAlpha = variant === "dark" ? 0.16 : 0.08;
  const glow = ctx.createRadialGradient(WIDTH * 0.85, HEIGHT * 0.12, 40, WIDTH * 0.85, HEIGHT * 0.12, 680);
  glow.addColorStop(0, palette.accent);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.restore();

  const [logoImg, qrDataUrl] = await Promise.all([
    shop.logoUrl ? loadImage(shop.logoUrl) : Promise.resolve(null),
    QRCode.toDataURL(url, { width: 420, margin: 1, color: { dark: "#111111", light: "#ffffff" } }),
  ]);
  const qrImg = await loadImage(qrDataUrl);

  const pad = 72;
  const innerW = WIDTH - pad * 2;

  if (product) {
    // --- PRODUCT / SERVICE STORY CARD ---
    // Top shop bar
    drawAvatar(ctx, logoImg, shop.name, pad + 44, 128, 88, palette);
    ctx.fillStyle = palette.ink;
    ctx.font = `700 38px ${palette.displayFont}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const shopTitle = wrapText(ctx, shop.name, innerW - 120, 1)[0] ?? shop.name;
    ctx.fillText(shopTitle, pad + 112, 114);

    ctx.fillStyle = palette.muted;
    ctx.font = `500 26px ${sans}`;
    const subline = shop.instagram ? `@${shop.instagram}` : `/tienda/${shop.slug}`;
    ctx.fillText(subline, pad + 112, 152);

    // Product hero image card
    const imgY = 224;
    const imgH = 920;
    const imgSrc = productImage(product);
    const prodImg = imgSrc ? await loadImage(imgSrc) : null;

    if (prodImg) {
      drawCover(ctx, prodImg, pad, imgY, innerW, imgH, 44);
    } else {
      ctx.fillStyle = palette.soft;
      roundRect(ctx, pad, imgY, innerW, imgH, 44);
      ctx.fill();
      ctx.fillStyle = palette.muted;
      ctx.font = `600 54px ${palette.displayFont}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const fallbackLines = wrapText(ctx, product.name, innerW - 120, 3);
      fallbackLines.forEach((line, idx) => {
        const y = imgY + imgH / 2 + (idx - (fallbackLines.length - 1) / 2) * 68;
        ctx.fillText(line, WIDTH / 2, y);
      });
    }

    // Subtle border around image
    ctx.save();
    ctx.strokeStyle = palette.rule;
    ctx.lineWidth = 2;
    roundRect(ctx, pad, imgY, innerW, imgH, 44);
    ctx.stroke();
    ctx.restore();

    // Optional badge / duration pill on image
    const badgeText = product.badge === "new"
      ? (en ? "NEW" : "NUEVO")
      : product.badge === "popular"
        ? "POPULAR"
        : product.badge === "sale"
          ? (en ? "SALE" : "OFERTA")
          : "";
    if (badgeText) {
      ctx.font = `700 26px ${sans}`;
      const tw = ctx.measureText(badgeText).width;
      const pillW = tw + 56;
      const pillH = 60;
      const pillX = pad + innerW - pillW - 32;
      const pillY = imgY + 32;
      ctx.fillStyle = palette.accent;
      roundRect(ctx, pillX, pillY, pillW, pillH, 30);
      ctx.fill();
      ctx.fillStyle = palette.accentInk;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(badgeText, pillX + pillW / 2, pillY + pillH / 2 + 1);
    }

    if (product.kind === "service" && product.durationMinutes > 0) {
      const durText = `${product.durationMinutes} min`;
      ctx.font = `600 26px ${sans}`;
      const tw = ctx.measureText(durText).width;
      const pillW = tw + 52;
      const pillH = 60;
      const pillX = pad + 32;
      const pillY = imgY + 32;
      ctx.fillStyle = "rgba(18, 18, 23, 0.72)";
      roundRect(ctx, pillX, pillY, pillW, pillH, 30);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(durText, pillX + pillW / 2, pillY + pillH / 2 + 1);
    }

    // Product details
    let cursorY = imgY + imgH + 64;
    ctx.fillStyle = palette.ink;
    ctx.font = `700 62px ${palette.displayFont}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const nameLines = wrapText(ctx, product.name, innerW, 2);
    for (const line of nameLines) {
      ctx.fillText(line, pad, cursorY);
      cursorY += 74;
    }

    // Price row
    cursorY += 8;
    const avail = isProductAvailable(product);
    const mainPrice = avail
      ? (hasSurcharges(product) ? (en ? "From " : "Desde ") : "") + price(product.priceCents, locale, shop.currency)
      : (en ? "Unavailable" : "No disponible");
    ctx.fillStyle = palette.accent;
    ctx.font = `700 54px ${sans}`;
    ctx.fillText(mainPrice, pad, cursorY);

    if (avail && product.compareAtCents && product.compareAtCents > product.priceCents) {
      const mainWidth = ctx.measureText(mainPrice).width;
      const oldText = price(product.compareAtCents, locale, shop.currency);
      ctx.fillStyle = palette.muted;
      ctx.font = `500 38px ${sans}`;
      const oldX = pad + mainWidth + 28;
      const oldY = cursorY + 12;
      ctx.fillText(oldText, oldX, oldY);
      const oldW = ctx.measureText(oldText).width;
      ctx.strokeStyle = palette.muted;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(oldX, oldY + 20);
      ctx.lineTo(oldX + oldW, oldY + 20);
      ctx.stroke();
    }

    cursorY += 74;
    if (product.description?.trim()) {
      ctx.fillStyle = palette.muted;
      ctx.font = `400 30px ${sans}`;
      const descLines = wrapText(ctx, product.description.trim(), innerW, 2);
      for (const line of descLines) {
        ctx.fillText(line, pad, cursorY);
        cursorY += 42;
      }
    }

    // Bottom QR CTA card
    const cardH = 290;
    const cardY = HEIGHT - pad - cardH - 36;
    ctx.fillStyle = palette.surface;
    roundRect(ctx, pad, cardY, innerW, cardH, 36);
    ctx.fill();
    ctx.strokeStyle = palette.rule;
    ctx.lineWidth = 2;
    ctx.stroke();

    const qrBox = 226;
    const qrX = pad + 32;
    const qrY = cardY + (cardH - qrBox) / 2;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, qrX, qrY, qrBox, qrBox, 24);
    ctx.fill();
    if (qrImg) {
      ctx.drawImage(qrImg, qrX + 14, qrY + 14, qrBox - 28, qrBox - 28);
    }

    const textX = qrX + qrBox + 38;
    const textMaxW = pad + innerW - textX - 32;
    const ctaTitle = product.kind === "service"
      ? (en ? "Scan to book" : "Escaneá para reservar")
      : (en ? "Scan to view & order" : "Escaneá para ver y pedir");

    ctx.fillStyle = palette.ink;
    ctx.font = `700 40px ${palette.displayFont}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const ctaLines = wrapText(ctx, ctaTitle, textMaxW, 2);
    let textY = cardY + 62;
    for (const line of ctaLines) {
      ctx.fillText(line, textX, textY);
      textY += 50;
    }

    ctx.fillStyle = palette.muted;
    ctx.font = `500 24px ui-monospace, SFMono-Regular, Menlo, monospace`;
    const urlLines = wrapText(ctx, formatDisplayUrl(url), textMaxW, 2);
    textY += 10;
    for (const line of urlLines) {
      ctx.fillText(line, textX, textY);
      textY += 34;
    }
  } else {
    // --- SHOP STORY CARD ---
    // Centered avatar + shop name + description
    drawAvatar(ctx, logoImg, shop.name, WIDTH / 2, 186, 152, palette);

    let cursorY = 300;
    ctx.fillStyle = palette.ink;
    ctx.font = `700 76px ${palette.displayFont}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const nameLines = wrapText(ctx, shop.name, innerW, 2);
    for (const line of nameLines) {
      ctx.fillText(line, WIDTH / 2, cursorY);
      cursorY += 88;
    }

    if (shop.description?.trim()) {
      cursorY += 12;
      ctx.fillStyle = palette.muted;
      ctx.font = `400 34px ${sans}`;
      const descLines = wrapText(ctx, shop.description.trim(), innerW - 60, 3);
      for (const line of descLines) {
        ctx.fillText(line, WIDTH / 2, cursorY);
        cursorY += 46;
      }
    }

    // Featured product collage (up to 3 photos)
    const featuredSources = shop.products
      .filter((p) => !p.hidden)
      .map((p) => productImage(p))
      .filter((src): src is string => Boolean(src))
      .slice(0, 3);
    const featuredImgs = (await Promise.all(featuredSources.map(loadImage))).filter((img): img is HTMLImageElement => Boolean(img));

    const collageY = Math.max(cursorY + 48, 590);
    const collageH = 580;

    if (featuredImgs.length === 3) {
      const gap = 22;
      const leftW = Math.round(innerW * 0.56);
      const rightW = innerW - leftW - gap;
      const rightH = Math.round((collageH - gap) / 2);
      drawCover(ctx, featuredImgs[0], pad, collageY, leftW, collageH, 36);
      drawCover(ctx, featuredImgs[1], pad + leftW + gap, collageY, rightW, rightH, 32);
      drawCover(ctx, featuredImgs[2], pad + leftW + gap, collageY + rightH + gap, rightW, rightH, 32);
    } else if (featuredImgs.length === 2) {
      const gap = 24;
      const colW = Math.round((innerW - gap) / 2);
      drawCover(ctx, featuredImgs[0], pad, collageY, colW, collageH, 36);
      drawCover(ctx, featuredImgs[1], pad + colW + gap, collageY, colW, collageH, 36);
    } else if (featuredImgs.length === 1) {
      drawCover(ctx, featuredImgs[0], pad, collageY, innerW, collageH, 40);
    } else {
      // Clean editorial card when there are no photos yet
      ctx.fillStyle = palette.surface;
      roundRect(ctx, pad, collageY, innerW, collageH, 40);
      ctx.fill();
      ctx.strokeStyle = palette.rule;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = palette.accent;
      ctx.font = `700 44px ${palette.displayFont}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        en ? "Explore our online catalog" : "Explorá nuestro catálogo en línea",
        WIDTH / 2,
        collageY + collageH / 2 - 24,
      );
      const publishedCount = shop.products.filter((p) => !p.hidden).length;
      if (publishedCount > 0) {
        ctx.fillStyle = palette.muted;
        ctx.font = `500 32px ${sans}`;
        ctx.fillText(
          en ? `${publishedCount} available options` : `${publishedCount} opciones disponibles`,
          WIDTH / 2,
          collageY + collageH / 2 + 40,
        );
      }
    }

    // Bottom QR card
    const cardH = 440;
    const cardY = HEIGHT - pad - cardH - 44;
    ctx.fillStyle = palette.surface;
    roundRect(ctx, pad, cardY, innerW, cardH, 40);
    ctx.fill();
    ctx.strokeStyle = palette.rule;
    ctx.lineWidth = 2;
    ctx.stroke();

    const qrBox = 310;
    const qrX = pad + 44;
    const qrY = cardY + (cardH - qrBox) / 2;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, qrX, qrY, qrBox, qrBox, 28);
    ctx.fill();
    if (qrImg) {
      ctx.drawImage(qrImg, qrX + 18, qrY + 18, qrBox - 36, qrBox - 36);
    }

    const textX = qrX + qrBox + 44;
    const textMaxW = pad + innerW - textX - 40;
    ctx.fillStyle = palette.ink;
    ctx.font = `700 46px ${palette.displayFont}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const cta = en ? "Scan to visit our shop" : "Escaneá para ver el catálogo";
    const ctaLines = wrapText(ctx, cta, textMaxW, 2);
    let textY = cardY + 94;
    for (const line of ctaLines) {
      ctx.fillText(line, textX, textY);
      textY += 58;
    }

    ctx.fillStyle = palette.accent;
    ctx.font = `600 28px ui-monospace, SFMono-Regular, Menlo, monospace`;
    textY += 16;
    const urlLines = wrapText(ctx, formatDisplayUrl(url), textMaxW, 2);
    for (const line of urlLines) {
      ctx.fillText(line, textX, textY);
      textY += 38;
    }

    if (shop.instagram) {
      ctx.fillStyle = palette.muted;
      ctx.font = `500 28px ${sans}`;
      ctx.fillText(`@${shop.instagram}`, textX, textY + 12);
    }
  }

  // Subtle footer watermark
  ctx.fillStyle = palette.muted;
  ctx.font = `600 24px ${sans}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("vitrina", WIDTH / 2, HEIGHT - 28);

  return canvas.toDataURL("image/png");
}
