"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading skeleton matching the Job Order DataTable layout.
 */
export function JobOrderSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-5 w-20" />
      </div>
      {Array.from({ length: 5 }).map((_, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between gap-4 py-2"
        >
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

