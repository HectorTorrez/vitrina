import { cloneElement, useId, useState, type ComponentProps, type FormEvent, type ReactElement, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Sends one panel action to /gestion, refreshes the panel data and reports the result in a toast. */
export function usePanelAction() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  async function run(input: Record<string, unknown>, success = "Cambios guardados") {
    setPending(true);
    try {
      const response = await fetch("/gestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (response.status === 401) {
        window.location.assign("/ingresar");
        return false;
      }
      if (!response.ok) throw new Error((await response.text()).trim() || "No se pudo guardar");
      toast.success(success);
      if (typeof input.shopSlug === "string") {
        void queryClient.invalidateQueries({ queryKey: ["shop", input.shopSlug] });
      }
      await router.invalidate();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar");
      return false;
    } finally {
      setPending(false);
    }
  }

  return { run, pending };
}

export function PanelForm({
  children, submit, payload, clear = false, onSaved, success, className,
}: {
  children: ReactNode;
  submit: string;
  payload: (form: FormData) => Record<string, unknown>;
  clear?: boolean;
  onSaved?: () => void;
  success?: string;
  className?: string;
}) {
  const { run, pending } = usePanelAction();

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    if (await run(payload(new FormData(form)), success)) {
      if (clear) form.reset();
      onSaved?.();
    }
  }

  return (
    <form onSubmit={save} className={className}>
      <fieldset disabled={pending} className="grid min-w-0 gap-6">
        {children}
        <div>
          <Button type="submit" size="lg" className="rounded-full px-6">
            {pending && <Loader2 className="animate-spin" />}
            {pending ? "Guardando…" : submit}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

export function SectionHead({ label, title, text }: { label: string; title: string; text?: string }) {
  return (
    <CardHeader className="gap-2">
      <p className="font-mono text-xs font-medium uppercase tracking-[0.1em] text-brand-ink">{label}</p>
      <CardTitle className="font-display text-3xl font-bold tracking-tight">{title}</CardTitle>
      {text && <CardDescription className="text-base">{text}</CardDescription>}
    </CardHeader>
  );
}

/** Label + control; the control receives the generated id. */
export function Field({ label, hint, className, children }: {
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
  children: ReactElement<{ id?: string }>;
}) {
  const id = useId();
  return (
    <div className={cn("grid min-w-0 gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {cloneElement(children, { id })}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function CheckField({ label, className, ...props }: ComponentProps<typeof Checkbox> & { label: ReactNode }) {
  const id = useId();
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Checkbox id={id} {...props} />
      <Label htmlFor={id} className="font-normal">{label}</Label>
    </div>
  );
}

/** Radix Select that still posts its value with the form (via `name`). */
export function FormSelect({ id, options, placeholder, className, ...props }: ComponentProps<typeof Select> & {
  id?: string;
  placeholder?: string;
  className?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select {...props}>
      <SelectTrigger id={id} className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export const slugPattern = "[a-z0-9]+(-[a-z0-9]+)*";
