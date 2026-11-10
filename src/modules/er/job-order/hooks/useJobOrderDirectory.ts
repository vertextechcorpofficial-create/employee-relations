"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CurrentUserDirectory,
  DepartmentOption,
  EmployeeOption,
} from "@/modules/er/job-order/types/job-order.schema";

/**
 * Fetches available target Departments, active Employees, and current user identity for Job Orders.
 */
export function useJobOrderDirectory() {
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUserDirectory | null>(
    null
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/er/job-order/directory", {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(body.message ?? "Failed to load departments and users");
      }
      const json = (await res.json()) as {
        data?: {
          departments?: DepartmentOption[];
          employees?: EmployeeOption[];
          currentUser?: CurrentUserDirectory;
        };
      };
      setDepartments(json.data?.departments ?? []);
      setEmployees(json.data?.employees ?? []);
      setCurrentUser(json.data?.currentUser ?? null);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to load directory";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    departments,
    employees,
    currentUser,
    isLoading,
    error,
    refresh,
  };
}

