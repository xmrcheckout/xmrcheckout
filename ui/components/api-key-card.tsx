"use client";

import CredentialCard from "./credential-card";
import { useI18n } from "./i18n-provider";

type ApiKeyCardProps = {
  apiKey: string;
};

export default function ApiKeyCard({ apiKey }: ApiKeyCardProps) {
  const { t } = useI18n();
  return (
    <CredentialCard
      label={t("credentials.yourApiKey")}
      value={apiKey}
      copyLabel={t("credentials.copyApiKey")}
    />
  );
}
