"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CreateServiceCategoryInput,
  ServiceCategory,
  UpdateServiceCategoryInput,
} from "@/modules/er/job-order/types/job-order.schema";

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string };
    return body.message ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Manages state and CRUD operations for Job Order Categories of Services.
 */
export function useServiceCategories() {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/er/job-order/categories", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res, "Failed to load service categories"));
      }
      const json = (await res.json()) as { data?: ServiceCategory[] };
      setCategories(json.data ?? []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load service categories";
      setError(msg);
      toast.error("Categories Error", { description: msg });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createCategory = useCallback(
    async (input: CreateServiceCategoryInput): Promise<ServiceCategory> => {
      setIsSubmitting(true);
      try {
        const res = await fetch("/api/er/job-order/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          throw new Error(await parseErrorMessage(res, "Failed to register category"));
        }
        const json = (await res.json()) as { data: ServiceCategory };
        setCategories((prev) =>
          [...prev, json.data].sort((a, b) =>
            a.category_name.localeCompare(b.category_name)
          )
        );
        toast.success("Service Category Registered", {
          description: `"${json.data.category_name}" is now available.`,
        });
        return json.data;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to register category";
        toast.error("Registration Failed", { description: msg });
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  const updateCategory = useCallback(
    async (id: number, input: UpdateServiceCategoryInput): Promise<ServiceCategory> => {
      setIsSubmitting(true);
      try {
        const res = await fetch(`/api/er/job-order/categories/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          throw new Error(await parseErrorMessage(res, "Failed to update category"));
        }
        const json = (await res.json()) as { data: ServiceCategory };
        setCategories((prev) =>
          prev
            .map((c) => (c.id === id ? json.data : c))
            .sort((a, b) => a.category_name.localeCompare(b.category_name))
        );
        toast.success("Service Category Updated");
        return json.data;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to update category";
        toast.error("Update Failed", { description: msg });
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  return {
    data: categories,
    categories,
    isLoading,
    isSubmitting,
    error,
    refresh,
    createCategory,
    updateCategory,
  };
}

