import { cloneElement, useId, useState, type ComponentProps, type FormEvent, type ReactElement, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { shopQuery } from "./catalog";
import { useI18n } from "./i18n";

async function post(input: Record<string, unknown>) {
  const response = await fetch("/gestion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (response.status === 401) {
    window.location.assign("/ingresar");
    throw new Error("Tu sesión venció");
  }
  if (!response.ok) throw new Error((await response.text()).trim() || "No se pudo guardar");
}

export function usePanelAction() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  async function many(inputs: Record<string, unknown>[], success = "Cambios guardados") {
    setPending(true);
    try {
      for (const input of inputs) await post(input);
      if (success) toast.success(success);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar");
      return false;
    } finally {
      for (const slug of new Set(inputs.map((input) => input.shopSlug))) {
        if (typeof slug === "string") void queryClient.invalidateQueries({ queryKey: shopQuery(slug).queryKey });
      }
      await router.invalidate();
      setPending(false);
    }
  }

  const run = (input: Record<string, unknown>, success?: string) => many([input], success);
  return { run, many, pending };
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

export function SectionHead({ label, title, text, action }: { label: string; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="grid gap-1.5">
        <p className="font-mono text-xs font-medium tracking-[0.1em] text-brand-ink uppercase">{label}</p>
        <h2 className="font-display text-3xl font-bold tracking-tight">{title}</h2>
        {text && <p className="text-muted-foreground">{text}</p>}
      </div>
      {action}
    </div>
  );
}

export function FormSection({ title, text, children, className, aside }: {
  title: string;
  text?: ReactNode;
  children: ReactNode;
  className?: string;
  aside?: ReactNode;
}) {
  return (
    <section className={cn("grid gap-5 rounded-2xl border bg-card p-5 sm:p-6", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <h3 className="font-display text-lg font-semibold tracking-tight">{title}</h3>
          {text && <p className="text-sm text-muted-foreground">{text}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, hint, error, counter, optional, className, children }: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null | false;
  counter?: { value: number; max: number };
  optional?: boolean;
  className?: string;
  children: ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>;
}) {
  const id = useId();
  const described = error ? id + "-error" : hint ? id + "-hint" : undefined;
  return (
    <div className={cn("grid min-w-0 content-start gap-2", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>
          {label}
          {optional && <span className="font-normal text-muted-foreground">(opcional)</span>}
        </Label>
        {counter && (
          <span className={cn("font-mono text-xs text-muted-foreground", counter.value > counter.max && "text-destructive")}>
            {counter.value}/{counter.max}
          </span>
        )}
      </div>
      {cloneElement(children, { id, "aria-invalid": error ? true : undefined, "aria-describedby": described })}
      {error ? <FieldError id={id + "-error"}>{error}</FieldError> : hint && <p id={id + "-hint"} className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-xs font-medium text-destructive">
      <AlertCircle className="mt-px size-3.5 shrink-0" /> {children}
    </p>
  );
}

export function AffixInput({ prefix, suffix, className, inputClassName, ...props }: ComponentProps<"input"> & {
  prefix?: ReactNode;
  suffix?: ReactNode;
  inputClassName?: string;
}) {
  return (
    <div className={cn(
      "flex h-10 w-full min-w-0 items-center rounded-lg border border-input bg-background shadow-xs transition-[color,box-shadow]",
      "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
      "has-[[aria-invalid=true]]:border-destructive has-[[aria-invalid=true]]:ring-destructive/20",
      "has-[:disabled]:opacity-60",
      className,
    )}>
      {prefix && <span className="pl-3 text-sm whitespace-nowrap text-muted-foreground select-none">{prefix}</span>}
      <input
        {...props}
        className={cn("h-full w-full min-w-0 bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground md:text-sm", prefix && "pl-1", suffix && "pr-1", inputClassName)}
      />
      {suffix && <span className="pr-1.5 text-sm text-muted-foreground">{suffix}</span>}
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
      <SelectTrigger id={id} className={cn("w-full min-w-0", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export interface Step {
  label: string;
  error?: boolean;
}

export function Stepper({ steps, current, onSelect, canSelect }: {
  steps: Step[];
  current: number;
  onSelect?: (index: number) => void;
  canSelect?: (index: number) => boolean;
}) {
  return (
    <ol className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]" aria-label="Pasos">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        const clickable = onSelect && (canSelect?.(index) ?? true);
        return (
          <li key={step.label} className="flex shrink-0 items-center gap-1.5">
            <button
              type="button" disabled={!clickable} onClick={() => onSelect?.(index)}
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex h-9 items-center gap-2 rounded-full pr-3.5 pl-1.5 text-sm transition disabled:cursor-default",
                active ? "bg-primary text-primary-foreground" : clickable ? "hover:bg-muted" : "",
              )}
            >
              <span className={cn(
                "grid size-6 place-items-center rounded-full text-xs font-semibold",
                active ? "bg-white/15" : step.error ? "bg-destructive/10 text-destructive" : done ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
              )}>
                {step.error && !active ? <AlertCircle className="size-3.5" /> : done ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
              </span>
              <span className={cn(!active && "text-muted-foreground", active && "font-medium")}>{step.label}</span>
            </button>
            {index < steps.length - 1 && <span className="h-px w-4 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}

export function SaveBar({ dirty, pending, onDiscard, submit, message }: {
  dirty: boolean;
  pending: boolean;
  onDiscard: () => void;
  submit?: string;
  message?: string;
}) {
  const { t } = useI18n();
  return (
    <div className={cn(
      "sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-ink-dark px-4 py-3 text-white shadow-2xl transition-all duration-300",
      dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
    )} aria-hidden={!dirty}>
      <p className="flex items-center gap-2 text-sm">
        <span className="size-2 rounded-full bg-brand" /> {message ?? t("common.unsavedChanges")}
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" className="rounded-full text-white hover:bg-white/10 hover:text-white" onClick={onDiscard} disabled={pending} tabIndex={dirty ? 0 : -1}>
          {t("common.discard")}
        </Button>
        <Button type="submit" className="rounded-full bg-brand px-5 text-ink-dark hover:bg-[#ffb088]" disabled={pending} tabIndex={dirty ? 0 : -1}>
          {pending && <Loader2 className="animate-spin" />}
          {pending ? t("common.saving") : (submit ?? t("common.save"))}
        </Button>
      </div>
    </div>
  );
}
