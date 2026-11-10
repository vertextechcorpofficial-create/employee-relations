"use client";

import { useState } from "react";
import {
  Calendar,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { formatDateTime } from "@/lib/utils";
import {
  JO_STATUS_VALUES,
  JobOrder,
  JobOrderStatus,
} from "@/modules/er/job-order/types/job-order.schema";
import { JobOrderStatusBadge } from "@/modules/er/job-order/components/data-table/JobOrderStatusBadge";

interface JobOrderDetailsModalProps {
  jobOrder: JobOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isReceiverMode?: boolean;
  isSubmitting?: boolean;
  onStatusChange?: (joId: number, status: JobOrderStatus) => Promise<void>;
}

/**
 * Displays a digital Job Order record, its picture/document attachments,
 * decoupled requester/receiver metadata, and direct status transitions for receivers.
 */
export function JobOrderDetailsModal({
  jobOrder,
  open,
  onOpenChange,
  isReceiverMode = false,
  isSubmitting = false,
  onStatusChange,
}: JobOrderDetailsModalProps) {
  const [pendingStatus, setPendingStatus] = useState<JobOrderStatus | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  if (!jobOrder) return null;

  const currentStatus = pendingStatus ?? jobOrder.status;
  const attachments = jobOrder.attachments ?? [];
  const pictures = attachments.filter((a) => a.attachment_kind === "PICTURE");
  const documents = attachments.filter((a) => a.attachment_kind === "DOCUMENT");

  const createdDate = jobOrder.created_at ? new Date(jobOrder.created_at) : null;
  const updatedDate = jobOrder.updated_at ? new Date(jobOrder.updated_at) : null;

  const handleApplyStatus = async () => {
    if (!onStatusChange || currentStatus === jobOrder.status) return;
    await onStatusChange(jobOrder.id, currentStatus);
    setPendingStatus(null);
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setPendingStatus(null);
      setPreviewImageUrl(null);
    }
    onOpenChange(nextOpen);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
          <DialogHeader>
            <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
              <div>
                <DialogTitle className="font-mono text-lg">
                  {jobOrder.jo_number}
                </DialogTitle>
                <DialogDescription>
                  Digital Job Order Record • {jobOrder.category_name ?? `Category #${jobOrder.category_id}`}
                </DialogDescription>
              </div>
              <JobOrderStatusBadge status={jobOrder.status} />
            </div>
          </DialogHeader>

          <div className="space-y-5">
            {/* Decoupled Actor Metadata (No FK) */}
            <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-2">
              <div className="flex items-start gap-2.5">
                <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div className="text-xs">
                  <p className="text-muted-foreground">Requester (ER)</p>
                  <p className="font-semibold text-foreground">
                    {jobOrder.requester_username}
                  </p>
                  <p className="text-muted-foreground">
                    User ID: {jobOrder.requester_user_id}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div className="text-xs">
                  <p className="text-muted-foreground">Last Updated By (Receiver)</p>
                  <p className="font-semibold text-foreground">
                    {jobOrder.receiver_username ?? "Awaiting Receiver Update"}
                  </p>
                  {jobOrder.receiver_user_id ? (
                    <p className="text-muted-foreground">
                      User ID: {jobOrder.receiver_user_id}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Remarks */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Remarks
                </span>
                <Badge variant="outline">
                  {jobOrder.category_name ?? `Category #${jobOrder.category_id}`}
                </Badge>
              </div>
              <div className="whitespace-pre-wrap rounded-lg border border-border bg-card p-3.5 text-sm leading-relaxed text-foreground">
                {jobOrder.remarks}
              </div>
            </div>

            {/* Pictures */}
            <div className="space-y-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <ImageIcon className="h-3.5 w-3.5" />
                Pictures ({pictures.length})
              </span>
              {pictures.length === 0 ? (
                <p className="text-xs text-muted-foreground">No pictures attached.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {pictures.map((pic) => {
                    const fileUrl = `/api/er/job-order/file?id=${pic.directus_file_id}`;
                    return (
                      <button
                        key={pic.id}
                        type="button"
                        onClick={() => setPreviewImageUrl(fileUrl)}
                        className="group relative aspect-video overflow-hidden rounded-lg border border-border bg-muted text-left transition-all hover:border-primary"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={fileUrl}
                          alt={pic.file_name}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-x-0 bottom-0 truncate bg-background/80 px-2 py-1 text-[10px] font-medium text-foreground backdrop-blur-xs">
                          {pic.file_name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Supporting Documents */}
            <div className="space-y-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                Supporting Documents ({documents.length})
              </span>
              {documents.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No supporting documents attached.
                </p>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => {
                    const viewUrl = `/api/er/job-order/file?id=${doc.directus_file_id}`;
                    const downloadUrl = `/api/er/job-order/file?id=${doc.directus_file_id}&download=true`;
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-2.5"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <FileText className="h-4 w-4 shrink-0 text-primary" />
                          <span className="truncate text-xs font-medium text-foreground">
                            {doc.file_name}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <Button variant="ghost" size="sm" asChild className="h-7 px-2">
                            <a href={viewUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="mr-1 h-3 w-3" />
                              Open
                            </a>
                          </Button>
                          <Button variant="outline" size="sm" asChild className="h-7 px-2">
                            <a href={downloadUrl} download={doc.file_name}>
                              <Download className="mr-1 h-3 w-3" />
                              Download
                            </a>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Timestamps */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Created:{" "}
                {createdDate && !Number.isNaN(createdDate.getTime())
                  ? formatDateTime(createdDate)
                  : "—"}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Updated:{" "}
                {updatedDate && !Number.isNaN(updatedDate.getTime())
                  ? formatDateTime(updatedDate)
                  : "—"}
              </span>
            </div>

            {/* Receiver Direct Status Update (No Acknowledge Gate) */}
            {isReceiverMode && onStatusChange && (
              <>
                <Separator />
                <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Update Job Order Status
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Direct status transition without acknowledgement step.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={currentStatus}
                      onValueChange={(val) =>
                        setPendingStatus(val as JobOrderStatus)
                      }
                      disabled={isSubmitting}
                    >
                      <SelectTrigger className="w-[150px] bg-background">
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
                    <Button
                      onClick={() => void handleApplyStatus()}
                      disabled={
                        isSubmitting || currentStatus === jobOrder.status
                      }
                    >
                      {isSubmitting && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Save Status
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Image Lightbox */}
      <Dialog
        open={Boolean(previewImageUrl)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPreviewImageUrl(null);
        }}
      >
        <DialogContent className="sm:max-w-[820px]">
          <DialogHeader>
            <DialogTitle>Attachment Preview</DialogTitle>
          </DialogHeader>
          {previewImageUrl && (
            <div className="flex max-h-[70vh] items-center justify-center overflow-hidden rounded-lg border border-border bg-muted p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImageUrl}
                alt="Job Order attachment preview"
                className="max-h-[65vh] w-auto rounded object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

