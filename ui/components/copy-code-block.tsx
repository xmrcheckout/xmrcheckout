"use client";

import type { ReactNode } from "react";
import { useRef, useState } from "react";

type CopyCodeBlockProps = {
  children: ReactNode;
  className: string;
  label?: string;
};

export default function CopyCodeBlock({
  children,
  className,
  label = "Code example",
}: CopyCodeBlockProps) {
  const codeRef = useRef<HTMLPreElement>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const code = codeRef.current?.textContent ?? "";

    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  };

  return (
    <div className="relative min-w-0 max-w-full overflow-hidden">
      <p role="status" aria-live="polite" className={copyFailed ? "p-3 text-sm text-red-700" : "sr-only"}>
        {copyFailed ? "Could not copy. Select and copy the text manually." : copied ? "Code copied to clipboard" : ""}
      </p>
      <pre ref={codeRef} className={className} tabIndex={0} role="region" aria-label={label}>
        {children}
      </pre>
      <button
        className="absolute right-3 top-3 inline-flex min-h-9 items-center justify-center rounded-full border border-cream/25 bg-ink/80 px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-cream transition hover:bg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
        type="button"
        onClick={handleCopy}
      >
        {copied ? "Copied" : "Copy code"}
      </button>
      <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-ink/80 px-2 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.06em] text-cream/70 sm:hidden">
        Scroll for more
      </span>
    </div>
  );
}
