"use client";

import { useFormState } from "react-dom";

import {
  resetApiKeyAction,
  type ApiKeyState,
} from "../app/(app)/dashboard/actions";
import ApiKeyCard from "./api-key-card";
import ConfirmSubmitButton from "./confirm-submit-button";
import { useI18n } from "./i18n-provider";

const initialState = (apiKey: string): ApiKeyState => ({
  apiKey,
  error: null,
});

type ApiKeySectionProps = {
  apiKey: string;
};

export default function ApiKeySection({ apiKey }: ApiKeySectionProps) {
  const { t } = useI18n();
  const [state, formAction] = useFormState(
    resetApiKeyAction,
    initialState(apiKey),
  );

  return (
    <div className="grid gap-4">
      <ApiKeyCard apiKey={state.apiKey} />
      {state.error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {state.error}
        </p>
      ) : null}
      <form action={formAction} className="flex justify-end">
        <ConfirmSubmitButton
          pendingLabel={t("common.resetting")}
          label={t("credentials.resetApiKey")}
          confirmLabel={t("credentials.resetApiKeyConfirm")}
          description={t("credentials.resetApiKeyDescription")}
        />
      </form>
    </div>
  );
}
