"use client";

import { useFormState } from "react-dom";

import {
  resetApiKeyAction,
  type ApiKeyState,
} from "../app/(app)/dashboard/actions";
import ApiKeyCard from "./api-key-card";
import ConfirmSubmitButton from "./confirm-submit-button";

const initialState = (apiKey: string): ApiKeyState => ({
  apiKey,
  error: null,
});

type ApiKeySectionProps = {
  apiKey: string;
};

export default function ApiKeySection({ apiKey }: ApiKeySectionProps) {
  const [state, formAction] = useFormState(
    resetApiKeyAction,
    initialState(apiKey),
  );

  return (
    <div className="grid gap-4">
      <ApiKeyCard apiKey={state.apiKey} />
      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {state.error}
        </p>
      ) : null}
      <form action={formAction} className="flex justify-end">
        <ConfirmSubmitButton
          label="Reset API key"
          confirmLabel="Reset and replace key"
          description="This immediately invalidates the current API key and may stop existing integrations until they are updated."
        />
      </form>
    </div>
  );
}
