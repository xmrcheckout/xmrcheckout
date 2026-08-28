"use client";

import { useFormState } from "react-dom";

import {
  resetWebhookSecretAction,
  type WebhookSecretState,
} from "../app/(app)/dashboard/actions";
import SecretCard from "./secret-card";
import ConfirmSubmitButton from "./confirm-submit-button";

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
    initialState(webhookSecret),
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
        <div className="border-l-2 border-clay bg-clay/5 px-4 py-3 text-sm text-ink-soft">
          Webhook secret unavailable. Reset to generate a new secret.
        </div>
      )}
      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {state.error}
        </p>
      ) : null}
      <form action={formAction} className="flex justify-end">
        <ConfirmSubmitButton
          label="Reset webhook secret"
          confirmLabel="Reset and replace secret"
          description="This changes the signing secret for future webhook deliveries. Update every receiver before relying on new signatures."
        />
      </form>
    </div>
  );
}
