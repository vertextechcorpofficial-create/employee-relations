"use client";

import { FolderCog, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyPlaceholder } from "@/components/shared/EmptyPlaceholder";
import { formatDateTime } from "@/lib/utils";
import { ServiceCategory } from "@/modules/er/job-order/types/job-order.schema";
import { JobOrderSkeleton } from "@/modules/er/job-order/components/data-table/JobOrderSkeleton";

interface CategoryTableProps {
  categories: ServiceCategory[];
  isLoading: boolean;
  isSubmitting?: boolean;
  onEdit: (category: ServiceCategory) => void;
  onToggleActive: (category: ServiceCategory, nextActive: boolean) => Promise<void>;
  onCreateNew: () => void;
}

/**
 * Displays registered Job Order Categories of Services with active toggle and edit action.
 */
export function CategoryTable({
  categories,
  isLoading,
  isSubmitting = false,
  onEdit,
  onToggleActive,
  onCreateNew,
}: CategoryTableProps) {
  if (isLoading && categories.length === 0) {
    return <JobOrderSkeleton />;
  }

  if (categories.length === 0) {
    return (
      <EmptyPlaceholder
        icon={FolderCog}
        title="No service categories registered"
        description="Register categories of services (e.g., IT Support, Facility Repair, System Concern) before filing Job Orders."
        actionLabel="Register Category"
        onAction={onCreateNew}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="font-semibold text-muted-foreground">
              Category Name
            </TableHead>
            <TableHead className="font-semibold text-muted-foreground">
              Description
            </TableHead>
            <TableHead className="font-semibold text-muted-foreground">
              Registered By
            </TableHead>
            <TableHead className="font-semibold text-muted-foreground">
              Status
            </TableHead>
            <TableHead className="font-semibold text-muted-foreground">
              Created At
            </TableHead>
            <TableHead className="text-right font-semibold text-muted-foreground">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((cat) => {
            const createdDate = cat.created_at ? new Date(cat.created_at) : null;
            return (
              <TableRow key={cat.id} className="hover:bg-muted/30">
                <TableCell className="font-medium text-foreground">
                  {cat.category_name}
                </TableCell>
                <TableCell className="max-w-[320px] truncate text-sm text-muted-foreground">
                  {cat.description || "—"}
                </TableCell>
                <TableCell className="text-xs">
                  <div className="font-medium text-foreground">
                    {cat.created_by_username ?? "System"}
                  </div>
                  {cat.created_by_user_id ? (
                    <div className="text-muted-foreground">
                      ID: {cat.created_by_user_id}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={cat.is_active}
                      disabled={isSubmitting}
                      onCheckedChange={(checked) =>
                        void onToggleActive(cat, checked)
                      }
                      aria-label={`Toggle ${cat.category_name} active state`}
                    />
                    <StatusBadge tone={cat.is_active ? "success" : "neutral"}>
                      {cat.is_active ? "Active" : "Inactive"}
                    </StatusBadge>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {createdDate && !Number.isNaN(createdDate.getTime())
                    ? formatDateTime(createdDate)
                    : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(cat)}
                    className="gap-1.5"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

