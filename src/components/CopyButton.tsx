"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

type CopyButtonProps = {
  value?: string;
  label?: string;
  className?: string;
};

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall back for embedded browsers that expose clipboard but deny writeText.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function CopyButton({ value = "", label = "Copy", className = "" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const disabled = !value.trim();
  const Icon = copied ? Check : Copy;

  async function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (disabled) return;

    await copyText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      title={disabled ? "Nothing to copy yet" : label}
      aria-live="polite"
    >
      <Icon className="h-3.5 w-3.5" />
      {copied ? "Copied" : label}
    </button>
  );
}
