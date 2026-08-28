import CredentialCard from "./credential-card";

type SecretCardProps = {
  label: string;
  value: string;
  buttonLabel: string;
};

export default function SecretCard({
  label,
  value,
  buttonLabel,
}: SecretCardProps) {
  return <CredentialCard label={label} value={value} copyLabel={buttonLabel} />;
}
