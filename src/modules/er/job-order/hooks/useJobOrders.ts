"use client";

import { useCallback, useEffect, useState } from "react";
import imageCompression from "browser-image-compression";
import { toast } from "sonner";
import {
  CreateJobOrderInput,
  JobOrder,
  JobOrderStatus,
  UploadedJobOrderFile,
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
 * Manages Job Order fetching, submission, attachment uploading, and status transitions.
 * @param {"my" | "all"} scope - Filters either requester-owned JOs or all receiver queue JOs.
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
      const res = await fetch(`/api/er/job-order?scope=${scope}`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(await parseApiError(res, "Failed to fetch job orders"));
      }
      const json = (await res.json()) as { data?: JobOrder[] };
      setJobOrders(json.data ?? []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch job orders";
      setError(msg);
      toast.error("Job Orders Error", { description: msg });
    } finally {
      setIsLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const uploadAttachment = useCallback(
    async (rawFile: File): Promise<UploadedJobOrderFile> => {
      let fileToUpload = rawFile;
      if (rawFile.type.startsWith("image/") && rawFile.size > 1024 * 1024) {
        fileToUpload = await imageCompression(rawFile, {
          maxSizeMB: 1.5,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        });
      }

      const formData = new FormData();
      formData.append("file", fileToUpload, rawFile.name);

      const res = await fetch("/api/er/job-order/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(await parseApiError(res, `Failed to upload "${rawFile.name}"`));
      }

      const json = (await res.json()) as { data: UploadedJobOrderFile };
      return json.data;
    },
    []
  );

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
          throw new Error(await parseApiError(res, "Failed to submit job order"));
        }
        const json = (await res.json()) as { data: JobOrder };
        setJobOrders((prev) => [json.data, ...prev]);
        toast.success("Job Order Submitted", {
          description: `Digital record ${json.data.jo_number} created.`,
        });
        return json.data;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to submit job order";
        toast.error("Submission Failed", { description: msg });
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  const updateStatus = useCallback(
    async (joId: number, status: JobOrderStatus): Promise<JobOrder> => {
      setIsSubmitting(true);
      try {
        const res = await fetch(`/api/er/job-order/${joId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (!res.ok) {
          throw new Error(await parseApiError(res, "Failed to update job order status"));
        }
        const json = (await res.json()) as { data: JobOrder };
        setJobOrders((prev) =>
          prev.map((item) => (item.id === joId ? json.data : item))
        );
        toast.success("Status Updated", {
          description: `${json.data.jo_number} marked as ${status}.`,
        });
        return json.data;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to update status";
        toast.error("Status Update Failed", { description: msg });
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
    uploadAttachment,
    submitJobOrder,
    updateStatus,
  };
}

