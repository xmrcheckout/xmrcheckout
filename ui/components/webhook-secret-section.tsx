"use client";

import { useFormState } from "react-dom";

import {
  resetWebhookSecretAction,
  type WebhookSecretState,
} from "../app/(app)/dashboard/actions";
import SecretCard from "./secret-card";
import ConfirmSubmitButton from "./confirm-submit-button";
import { useI18n } from "./i18n-provider";

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
  const { t } = useI18n();
  const [state, formAction] = useFormState(
    resetWebhookSecretAction,
    initialState(webhookSecret),
  );

  return (
    <div className="grid gap-4">
      {state.webhookSecret ? (
        <SecretCard
          label={t("credentials.yourWebhookSecret")}
          value={state.webhookSecret}
          buttonLabel={t("credentials.copyWebhookSecret")}
        />
      ) : (
        <div className="border-l-2 border-clay bg-clay/5 px-4 py-3 text-sm text-ink-soft">
          {t("credentials.webhookSecretUnavailable")}
        </div>
      )}
      {state.error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {state.error}
        </p>
      ) : null}
      <form action={formAction} className="flex justify-end">
        <ConfirmSubmitButton
          pendingLabel={t("common.resetting")}
          label={t("credentials.resetWebhookSecret")}
          confirmLabel={t("credentials.resetWebhookSecretConfirm")}
          description={t("credentials.resetWebhookSecretDescription")}
        />
      </form>
    </div>
  );
}
