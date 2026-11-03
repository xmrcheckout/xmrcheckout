"use client";

import { useEffect } from "react";

import type { InvoiceStatus } from "../lib/invoice-status";

type BtcpayModalBridgeProps = {
  invoiceId: string;
  status: InvoiceStatus;
};

const statusMap: Record<InvoiceStatus, string> = {
  pending: "New",
  // BTCPay keeps underpaid invoices in "New" (additional status PaidPartial).
  partially_paid: "New",
  payment_detected: "Processing",
  // BTCPay's postMessage contract requires this exact protocol value.
  // https://docs.btcpayserver.org/Development/ecommerce-integration-guide/
  // Customer-facing text uses "Confirmed".
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
