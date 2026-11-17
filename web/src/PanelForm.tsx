import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

export function PanelForm({
  children, submit, payload, clear = false, onSaved,
}: {
  children: ReactNode;
  submit: string;
  payload: (form: FormData) => Record<string, unknown>;
  clear?: boolean;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (pending) return;
    setPending(true);
    setMessage(undefined);
    try {
      const input = payload(new FormData(form));
      const response = await fetch("/gestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (response.status === 401) {
        window.location.assign("/ingresar");
        return;
      }
      if (!response.ok) throw new Error((await response.text()).trim() || "No se pudo guardar");
      if (clear) form.reset();
      onSaved?.();
      setMessage({ text: "Cambios guardados." });
      if (typeof input.shopSlug === "string") {
        void queryClient.invalidateQueries({ queryKey: ["shop", input.shopSlug] });
      }
      await router.invalidate();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "No se pudo guardar", error: true });
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="panel-form" onSubmit={save}>
      <fieldset disabled={pending}>
        {children}
        <button type="submit">{pending ? "Guardando…" : submit}</button>
      </fieldset>
      {message && <p role={message.error ? "alert" : "status"}>{message.text}</p>}
    </form>
  );
}
