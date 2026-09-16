"use client";

import { useCallback, useState } from "react";

type ShareButtonProps = {
  title: string;
  text: string;
  url?: string;
  label: string;
  className?: string;
};

/**
 * Uses the native share sheet when the device has one (WhatsApp, Telegram,
 * Messages ...) and falls back to copying the text to the clipboard.
 */
export default function ShareButton({
  title,
  text,
  url,
  label,
  className = "btn btn-secondary",
}: ShareButtonProps) {
  const [state, setState] = useState<"idle" | "shared" | "copied" | "failed">("idle");

  const flash = useCallback((next: "shared" | "copied" | "failed") => {
    setState(next);
    window.setTimeout(() => setState("idle"), 2200);
  }, []);

  const handleClick = useCallback(async () => {
    const shareText = url ? `${text}\n${url}` : text;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        flash("shared");
        return;
      } catch {
        // The guest dismissed the share sheet; fall through to copying.
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      flash("copied");
    } catch {
      flash("failed");
    }
  }, [flash, text, title, url]);

  return (
    <button type="button" className={className} onClick={handleClick}>
      {state === "idle" ? label : null}
      {state === "shared" ? "Shared" : null}
      {state === "copied" ? "Copied to clipboard" : null}
      {state === "failed" ? "Copy manually" : null}
    </button>
  );
}