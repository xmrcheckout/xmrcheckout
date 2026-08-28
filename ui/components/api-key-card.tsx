import CredentialCard from "./credential-card";

type ApiKeyCardProps = {
  apiKey: string;
};

export default function ApiKeyCard({ apiKey }: ApiKeyCardProps) {
  return (
    <CredentialCard
      label="Your API key"
      value={apiKey}
      copyLabel="Copy API key"
    />
  );
}
