"use client";

import { useFormState } from "react-dom";

import {
  resetWebhookSecretAction,
  type WebhookSecretState,
} from "../app/(app)/dashboard/actions";
import SecretCard from "./secret-card";

const initialState = (webhookSecret: string | null): WebhookSecretState => ({
  webhookSecret,
  error: null,
});

type WebhookSecretSectionProps = {
  webhookSecret: string | null;
};

export default function WebhookSecretSection({
  webhookSecret,
}: WebhookSecretSectionProps) {
  const [state, formAction] = useFormState(
    resetWebhookSecretAction,
    initialState(webhookSecret)
  );

  return (
    <div className="grid gap-4">
      {state.webhookSecret ? (
        <SecretCard
          label="Your webhook secret"
          value={state.webhookSecret}
          buttonLabel="Copy webhook secret"
        />
      ) : (
        <div className="rounded-2xl border border-stroke bg-white/80 p-6 text-sm text-ink-soft shadow-soft backdrop-blur">
          Webhook secret unavailable. Reset to generate a new secret.
        </div>
      )}
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
          Reset webhook secret
        </button>
      </form>
    </div>
  );
}
