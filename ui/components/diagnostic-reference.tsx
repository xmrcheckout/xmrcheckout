"use client";

import { useState } from "react";
import { useI18n } from "./i18n-provider";

export default function DiagnosticReference({ value }: { value: string }) {
  const { t } = useI18n();
  const [feedback, setFeedback] = useState("");
  return (
    <div className="min-w-0 text-sm">
      <p>{t("diagnostic.label")} <code className="break-all select-all">{value}</code></p>
      <button
        type="button"
        className="mt-2 min-h-11 rounded-full border border-stroke px-4 py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setFeedback(t("diagnostic.copied"));
          } catch {
            setFeedback(t("diagnostic.copyFailed"));
          }
        }}
      >{t("diagnostic.copy")}</button>
      <p role="status" className="mt-1">{feedback}</p>
    </div>
  );
}
