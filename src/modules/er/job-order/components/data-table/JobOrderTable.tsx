"use client";

import { Eye, FileText, Image as ImageIcon, Ticket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  JO_STATUS_VALUES,
  JobOrder,
  JobOrderStatus,
} from "@/modules/er/job-order/types/job-order.schema";
import { JobOrderStatusBadge } from "@/modules/er/job-order/components/data-table/JobOrderStatusBadge";
import { JobOrderSkeleton } from "@/modules/er/job-order/components/data-table/JobOrderSkeleton";

interface JobOrderTableProps {
  jobOrders: JobOrder[];
  isLoading: boolean;
  isSubmitting?: boolean;
  isReceiverMode?: boolean;
  onViewDetails: (jo: JobOrder) => void;
  onStatusChange?: (joId: number, status: JobOrderStatus) => Promise<void>;
  onCreateNew?: () => void;
}

/**
 * Displays the list of digital Job Orders for either Requester or Receiver POV.
 */
export function JobOrderTable({
  jobOrders,
  isLoading,
  isSubmitting = false,
  isReceiverMode = false,
  onViewDetails,
  onStatusChange,
  onCreateNew,
}: JobOrderTableProps) {
  if (isLoading && jobOrders.length === 0) {
    return <JobOrderSkeleton />;
  }

  if (jobOrders.length === 0) {
    return (
      <EmptyPlaceholder
        icon={Ticket}
        title={
          isReceiverMode
            ? "No incoming Job Orders yet"
            : "No Job Orders submitted yet"
        }
        description={
          isReceiverMode
            ? "Digital Job Orders submitted from Employee Relations will appear here for direct status updates."
            : "Submit your first digital Job Order with service category, remarks, and supporting attachments."
        }
        actionLabel={!isReceiverMode && onCreateNew ? "Submit Job Order" : undefined}
        onAction={!isReceiverMode ? onCreateNew : undefined}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="font-semibold text-muted-foreground">
              JO Number
            </TableHead>
            <TableHead className="font-semibold text-muted-foreground">
              Service Category
            </TableHead>
            <TableHead className="font-semibold text-muted-foreground">
              Remarks
            </TableHead>
            <TableHead className="font-semibold text-muted-foreground">
              Attachments
            </TableHead>
            <TableHead className="font-semibold text-muted-foreground">
              Requester
            </TableHead>
            <TableHead className="font-semibold text-muted-foreground">
              Status
            </TableHead>
            <TableHead className="font-semibold text-muted-foreground">
              Filed On
            </TableHead>
            <TableHead className="text-right font-semibold text-muted-foreground">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobOrders.map((jo) => {
            const attachments = jo.attachments ?? [];
            const pictureCount = attachments.filter(
              (a) => a.attachment_kind === "PICTURE"
            ).length;
            const docCount = attachments.filter(
              (a) => a.attachment_kind === "DOCUMENT"
            ).length;
            const createdDate = jo.created_at ? new Date(jo.created_at) : null;

            return (
              <TableRow
                key={jo.id}
                className="cursor-pointer transition-colors hover:bg-muted/30"
                onClick={() => onViewDetails(jo)}
              >
                <TableCell className="font-mono text-xs font-semibold text-foreground">
                  {jo.jo_number}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-medium">
                    {jo.category_name ?? `Category #${jo.category_id}`}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[260px] truncate text-sm text-foreground">
                  {jo.remarks}
                </TableCell>
                <TableCell>
                  {attachments.length === 0 ? (
                    <span className="text-xs text-muted-foreground">None</span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {pictureCount > 0 && (
                        <Badge
                          variant="secondary"
                          className="gap-1 px-1.5 py-0.5 text-xs"
                        >
                          <ImageIcon className="h-3 w-3" />
                          {pictureCount}
                        </Badge>
                      )}
                      {docCount > 0 && (
                        <Badge
                          variant="secondary"
                          className="gap-1 px-1.5 py-0.5 text-xs"
                        >
                          <FileText className="h-3 w-3" />
                          {docCount}
                        </Badge>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-xs">
                  <div className="font-medium text-foreground">
                    {jo.requester_username}
                  </div>
                  <div className="text-muted-foreground">
                    ID: {jo.requester_user_id}
                  </div>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {isReceiverMode && onStatusChange ? (
                    <Select
                      value={jo.status}
                      disabled={isSubmitting}
                      onValueChange={(val) =>
                        void onStatusChange(jo.id, val as JobOrderStatus)
                      }
                    >
                      <SelectTrigger className="h-8 w-[140px] bg-background text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {JO_STATUS_VALUES.map((statusOption) => (
                          <SelectItem key={statusOption} value={statusOption}>
                            {statusOption}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <JobOrderStatusBadge status={jo.status} />
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {createdDate && !Number.isNaN(createdDate.getTime())
                    ? formatDateTime(createdDate)
                    : "—"}
                </TableCell>
                <TableCell
                  className="text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewDetails(jo)}
                    className="gap-1.5"
                  >
                    <Eye className="h-4 w-4" />
                    View
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

