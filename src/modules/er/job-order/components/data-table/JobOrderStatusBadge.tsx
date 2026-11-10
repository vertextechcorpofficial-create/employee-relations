"use client";

import { StatusBadge, StatusTone } from "@/components/ui/status-badge";
import { JobOrderStatus } from "@/modules/er/job-order/types/job-order.schema";

const STATUS_TONE_MAP: Record<JobOrderStatus, StatusTone> = {
  Open: "info",
  "In Progress": "warning",
  Resolved: "success",
  Cancelled: "destructive",
};

/**
 * Renders a semantic theme-compliant status badge for a digital Job Order.
 */
export function JobOrderStatusBadge({ status }: { status: JobOrderStatus }) {
  const tone = STATUS_TONE_MAP[status] ?? "neutral";
  return <StatusBadge tone={tone}>{status}</StatusBadge>;
}

