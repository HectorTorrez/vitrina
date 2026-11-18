import { useState } from "react";

export function useCopied(ms = 1500) {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) =>
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), ms);
    });
  return [copied, copy] as const;
}
