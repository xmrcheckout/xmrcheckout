export type StatusTone =
  "neutral" | "pending" | "detected" | "success" | "error";

type StatusBadgeProps = {
  label: string;
  tone?: StatusTone;
  className?: string;
};

const toneClasses: Record<StatusTone, string> = {
  neutral: "border-stroke bg-white/70 text-ink",
  pending: "border-amber-300 bg-amber-50 text-amber-950",
  detected: "border-monero/50 bg-[#fff0e6] text-ink",
  success: "border-sage/50 bg-[#e3ebe6] text-ink",
  error: "border-red-200 bg-red-50 text-red-700",
};

export default function StatusBadge({
  label,
  tone = "neutral",
  className = "",
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.06em] ${toneClasses[tone]} ${className}`}
    >
      {label}
    </span>
  );
}
