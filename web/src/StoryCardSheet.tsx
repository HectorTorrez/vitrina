import { useEffect, useState } from "react";
import { Download, Loader2, Share2, Sparkles } from "lucide-react";
import type { Product, Shop } from "./catalog";
import { useI18n } from "./i18n";
import { renderStoryCard, type StoryCardVariant } from "./storyCard";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type StoryShop = Pick<
  Shop,
  "slug" | "name" | "description" | "theme" | "accentColor" | "style" | "logoUrl" | "currency" | "instagram" | "whatsapp" | "products"
>;

export function StoryCardSheet({
  shop,
  product,
  open,
  onOpenChange,
}: {
  shop: StoryShop;
  product?: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { locale } = useI18n();
  const en = locale === "en";
  const [variant, setVariant] = useState<StoryCardVariant>("theme");
  const [dataUrl, setDataUrl] = useState("");
  const [rendering, setRendering] = useState(false);

  const filename = product ? `${shop.slug}-${product.slug}-story.png` : `${shop.slug}-story.png`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setRendering(true);
    const path = product ? `/tienda/${shop.slug}/${product.slug}` : `/tienda/${shop.slug}`;
    const url = window.location.origin + path;
    void renderStoryCard({ shop, product, url, locale, variant })
      .then((png) => {
        if (!cancelled) setDataUrl(png);
      })
      .catch(() => {
        if (!cancelled) setDataUrl("");
      })
      .finally(() => {
        if (!cancelled) setRendering(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, shop, product, locale, variant]);

  function download() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.click();
  }

  async function share() {
    if (!dataUrl || typeof navigator === "undefined" || !navigator.share) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: product ? `${product.name} · ${shop.name}` : shop.name,
        });
      }
    } catch {
      // User cancelled share dialog
    }
  }

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-4 overflow-y-auto p-6">
        <div className="grid gap-1">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand-ink" />
            {en ? "Story card (9:16)" : "Tarjeta para historia (9:16)"}
          </SheetTitle>
          <SheetDescription>
            {en
              ? "Ready to share on Instagram Stories, WhatsApp Status, or TikTok."
              : "Lista para compartir en Historias de Instagram o Estados de WhatsApp."}
          </SheetDescription>
        </div>

        <div className="flex rounded-full border bg-muted/40 p-1">
          {([
            ["theme", en ? "Shop theme" : "Tema de tu tienda"],
            ["dark", en ? "Dark editorial" : "Oscuro elegante"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setVariant(value)}
              className={cn(
                "h-8 flex-1 rounded-full text-xs font-medium transition",
                variant === value ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative mx-auto w-full max-w-[260px] overflow-hidden rounded-2xl border bg-muted shadow-md" style={{ aspectRatio: "9 / 16" }}>
          {dataUrl ? (
            <img src={dataUrl} alt={product ? product.name : shop.name} className={cn("size-full object-cover transition-opacity", rendering && "opacity-50")} />
          ) : (
            <div className="grid size-full place-items-center text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          )}
          {rendering && dataUrl && (
            <span className="absolute inset-0 grid place-items-center bg-black/15">
              <Loader2 className="size-6 animate-spin text-white" />
            </span>
          )}
        </div>

        <div className="grid gap-2">
          <Button type="button" size="lg" disabled={!dataUrl || rendering} className="rounded-full" onClick={download}>
            <Download /> {en ? "Download Story PNG" : "Descargar PNG (1080×1920)"}
          </Button>
          {canShare && (
            <Button type="button" variant="outline" size="lg" disabled={!dataUrl || rendering} className="rounded-full" onClick={() => void share()}>
              <Share2 /> {en ? "Share" : "Compartir"}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
