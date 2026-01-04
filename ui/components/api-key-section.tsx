"use client";

import { useFormState } from "react-dom";

import { resetApiKeyAction, type ApiKeyState } from "../app/(app)/dashboard/actions";
import ApiKeyCard from "./api-key-card";

const initialState = (apiKey: string): ApiKeyState => ({
  apiKey,
  error: null,
});

type ApiKeySectionProps = {
  apiKey: string;
};

export default function ApiKeySection({ apiKey }: ApiKeySectionProps) {
  const [state, formAction] = useFormState(resetApiKeyAction, initialState(apiKey));

  return (
    <div className="grid gap-4">
      <ApiKeyCard apiKey={state.apiKey} />
      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {state.error}
        </p>
      ) : null}
      <form action={formAction} className="flex justify-end">
        <button
          className="inline-flex items-center justify-center rounded-full border border-stroke bg-white/60 px-5 py-2.5 text-sm font-semibold text-ink transition hover:-translate-y-0.5"
          type="submit"
        >
          Reset API key
        </button>
      </form>
    </div>
  );
}
