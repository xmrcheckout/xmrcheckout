import { useXmrFiatRate } from "./use-xmr-fiat-rate";

export const useXmrUsdRate = (enabled = true) =>
  useXmrFiatRate(enabled ? "USD" : null);
