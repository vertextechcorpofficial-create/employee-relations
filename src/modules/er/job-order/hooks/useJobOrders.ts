"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CreateJobOrderInput,
  JobOrder,
  UpdateJobOrderInput,
} from "@/modules/er/job-order/types/job-order.schema";

async function parseApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string };
    return body.message ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Manages Job Order fetching, submission, and status/routing updates.
 * @param {"my" | "all"} scope - Filters requester-owned JOs or all JOs.
 */
export function useJobOrders(scope: "my" | "all" = "all") {
  const [jobOrders, setJobOrders] = useState<JobOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/er/job-order?scope=${scope}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(await parseApiError(res, "Failed to fetch job orders"));
      }
      const json = (await res.json()) as { data?: JobOrder[] };
      setJobOrders(json.data ?? []);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to fetch job orders";
      setError(msg);
      toast.error("Job Orders Error", { description: msg });
    } finally {
      setIsLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submitJobOrder = useCallback(
    async (input: CreateJobOrderInput): Promise<JobOrder> => {
      setIsSubmitting(true);
      try {
        const res = await fetch("/api/er/job-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          throw new Error(
            await parseApiError(res, "Failed to submit job order")
          );
        }
        const json = (await res.json()) as { data: JobOrder };
        setJobOrders((prev) => [json.data, ...prev]);
        toast.success("Job Order Submitted", {
          description: `${json.data.jo_number} directed to ${json.data.target_department_name ?? json.data.target_username ?? "Receiver"}.`,
        });
        return json.data;
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Failed to submit job order";
        toast.error("Submission Failed", { description: msg });
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  const updateJobOrder = useCallback(
    async (joId: number, input: UpdateJobOrderInput): Promise<JobOrder> => {
      setIsSubmitting(true);
      try {
        const res = await fetch(`/api/er/job-order/${joId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          throw new Error(
            await parseApiError(res, "Failed to update job order")
          );
        }
        const json = (await res.json()) as { data: JobOrder };
        setJobOrders((prev) =>
          prev.map((item) => (item.id === joId ? json.data : item))
        );
        toast.success("Job Order Updated", {
          description: input.status
            ? `${json.data.jo_number} marked as ${input.status}.`
            : `${json.data.jo_number} routing updated.`,
        });
        return json.data;
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Failed to update job order";
        toast.error("Update Failed", { description: msg });
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  return {
    data: jobOrders,
    jobOrders,
    isLoading,
    isSubmitting,
    error,
    refresh,
    submitJobOrder,
    updateJobOrder,
  };
}
