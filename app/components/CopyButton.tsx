"use client";

import { useCallback, useState } from "react";

type CopyButtonProps = {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
};

/** Copy-to-clipboard button with an inline confirmation label. */
export default function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  className = "btn btn-primary",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Older/insecure browsers: show the value so the guest can copy by hand.
      window.prompt("Copy this value", value);
    }
  }, [value]);

  return (
    <button type="button" className={className} onClick={handleCopy}>
      {copied ? copiedLabel : label}
    </button>
  );
}