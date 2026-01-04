"use client";

import { useEffect } from "react";

type InvoiceStatus =
  | "pending"
  | "payment_detected"
  | "confirmed"
  | "expired"
  | "invalid";

type BtcpayModalBridgeProps = {
  invoiceId: string;
  status: InvoiceStatus;
};

const statusMap: Record<InvoiceStatus, string> = {
  pending: "New",
  payment_detected: "Processing",
  confirmed: "Settled",
  expired: "Expired",
  invalid: "Invalid",
};

const postToParent = (payload: unknown) => {
  if (typeof window === "undefined" || !window.parent) {
    return;
  }
  window.parent.postMessage(payload, "*");
};

export default function BtcpayModalBridge({
  invoiceId,
  status,
}: BtcpayModalBridgeProps) {
  useEffect(() => {
    postToParent("loaded");
  }, []);

  useEffect(() => {
    postToParent({
      invoiceId,
      status: statusMap[status] ?? "new",
    });
  }, [invoiceId, status]);

  return null;
}
