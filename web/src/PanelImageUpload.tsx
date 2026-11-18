import { useRef, useState } from "react";
import { Check, ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FieldError } from "./PanelForm";
import { uploadImage } from "./uploadImage";

interface ImageUploadProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBusyChange?: (busy: boolean) => void;
  variant?: "product" | "logo" | "background";
}

export function PanelImageUpload({ label, value, onChange, onBusyChange, variant = "product" }: ImageUploadProps) {
  const [status, setStatus] = useState<{ text: string; error?: boolean; busy?: boolean }>();
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (status?.busy || input.current?.matches(":disabled")) return;
    onBusyChange?.(true);
    setStatus({ text: "Subiendo foto…", busy: true });
    try {
      const url = await uploadImage(file);
      if (!url) return;
      onChange(url);
      setStatus({ text: "Foto lista." });
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : "No se pudo subir la foto", error: true });
    } finally {
      onBusyChange?.(false);
    }
  }

  const compact = variant !== "product";
  const choose = () => input.current?.click();
  const remove = () => { onChange(""); setStatus(undefined); };

  return (
    <div role="group" aria-label={label} aria-busy={status?.busy} className={cn("grid content-start", compact ? "gap-1.5" : "gap-5")}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void upload(file);
        }}
        className={cn(
          compact
            ? "grid gap-2 rounded-xl border border-dashed bg-card p-2 transition"
            : "relative grid aspect-[4/3] place-items-center overflow-hidden rounded-2xl border-2 border-dashed bg-muted/40 transition sm:aspect-[16/10]",
          dragging && "border-primary bg-accent",
        )}
      >
        {compact ? (
          <>
            <button
              type="button" onClick={choose} aria-label={`${value ? "Cambiar" : "Elegir"} imagen: ${label}`}
              className="relative grid aspect-video w-full place-items-center overflow-hidden rounded-lg bg-muted/60 transition hover:bg-muted"
            >
              {value ? (
                variant === "logo"
                  ? <img src={value} alt="" referrerPolicy="no-referrer" className="size-20 rounded-full bg-card object-cover shadow-sm ring-4 ring-card" />
                  : <img src={value} alt="" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover" />
              ) : (
                <span className="grid justify-items-center gap-2 px-3 text-center">
                  <span className={cn("grid size-11 place-items-center bg-card text-muted-foreground shadow-xs ring-1 ring-border",
                    variant === "logo" ? "rounded-full" : "rounded-xl")}>
                    <ImageIcon className="size-5" />
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">Tocá o arrastrá una imagen</span>
                </span>
              )}
              {status?.busy && <span className="absolute inset-0 grid place-items-center bg-black/40"><Loader2 className="size-6 animate-spin text-white" /></span>}
            </button>
            <div className="flex items-center gap-1.5">
              <Button type="button" size="sm" variant="secondary" className="flex-1 rounded-full" disabled={status?.busy} onClick={choose}>
                <Upload /> {value ? "Cambiar" : "Subir"}
              </Button>
              {value && (
                <Button type="button" size="icon-sm" variant="ghost" className="rounded-full text-muted-foreground hover:text-destructive" disabled={status?.busy} onClick={remove} aria-label={`Quitar ${label.toLowerCase()}`}>
                  <Trash2 />
                </Button>
              )}
            </div>
          </>
        ) : value ? (
          <>
            <img src={value} alt="" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover" />
            <div className="absolute right-3 bottom-3 flex gap-2">
              <Button type="button" size="sm" disabled={status?.busy} variant="secondary" className="rounded-full shadow" onClick={choose}><Upload /> Cambiar</Button>
              <Button type="button" size="sm" disabled={status?.busy} variant="secondary" className="rounded-full shadow" onClick={remove}><Trash2 /> Quitar</Button>
            </div>
          </>
        ) : (
          <button type="button" onClick={choose} className="grid justify-items-center gap-3 p-6 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-card shadow-sm">
              {status?.busy ? <Loader2 className="size-6 animate-spin" /> : <ImageIcon className="size-6 text-muted-foreground" />}
            </span>
            <span className="font-semibold">Arrastrá una foto o tocá para elegirla</span>
            <span className="text-sm text-muted-foreground">JPG, PNG, WebP o GIF · hasta 5 MB · formato vertical u horizontal</span>
          </button>
        )}
        {!compact && status?.busy && value && <span className="absolute inset-0 grid place-items-center bg-black/40"><Loader2 className="size-8 animate-spin text-white" /></span>}
        <input
          aria-label={label} ref={input} type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,image/gif" tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
      </div>
      {status && !status.busy && (
        status.error ? <FieldError>{status.text}</FieldError> : <p role="status" className={cn("flex items-center gap-1.5 text-success", compact ? "text-xs" : "text-sm")}><Check className="size-4" /> {status.text}</p>
      )}
    </div>
  );
}
