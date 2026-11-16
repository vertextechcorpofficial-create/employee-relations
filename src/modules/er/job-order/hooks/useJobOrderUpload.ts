"use client";

import { useCallback, useState } from "react";
import imageCompression from "browser-image-compression";
import {
  JO_ALLOWED_FILE_EXTENSIONS,
  JO_MAX_FILE_BYTES,
  UploadedJobOrderFile,
} from "@/modules/er/job-order/types/job-order.schema";

const ALLOWED_EXTENSIONS = new Set<string>(JO_ALLOWED_FILE_EXTENSIONS);

function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot <= 0) return "";
  return fileName.slice(lastDot + 1).toLowerCase().trim();
}

function resolveUploadFileName(originalName: string, compressedType: string): string {
  const extByMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const nextExt = extByMime[compressedType];
  if (!nextExt) return originalName;
  const lastDot = originalName.lastIndexOf(".");
  const baseName = lastDot > 0 ? originalName.slice(0, lastDot) : originalName;
  return `${baseName}.${nextExt}`;
}

/**
 * Manages client-side file validation, safe image compression, upload, and staged cleanup
 * for Job Order attachments.
 */
export function useJobOrderUpload() {
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const uploadAttachment = useCallback(
    async (rawFile: File): Promise<UploadedJobOrderFile> => {
      const ext = getFileExtension(rawFile.name);
      if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
        throw new Error(
          `Unsupported file "${rawFile.name}". Allowed: PNG, JPG, WEBP, GIF, PDF, Word, Excel, CSV, TXT.`
        );
      }

      const isNonImage = !rawFile.type.startsWith("image/");
      if (isNonImage && rawFile.size > JO_MAX_FILE_BYTES) {
        throw new Error(`"${rawFile.name}" exceeds the 10MB file size limit.`);
      }

      setIsUploading(true);
      try {
        let fileToUpload: File | Blob = rawFile;
        let uploadFileName = rawFile.name;

        // Skip GIF compression to avoid stripping animation frames via <canvas>
        if (
          rawFile.type.startsWith("image/") &&
          rawFile.type !== "image/gif" &&
          rawFile.size > 1024 * 1024
        ) {
          fileToUpload = await imageCompression(rawFile, {
            maxSizeMB: 1.5,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
          });
          if (fileToUpload.type && fileToUpload.type !== rawFile.type) {
            uploadFileName = resolveUploadFileName(rawFile.name, fileToUpload.type);
          }
        }

        if (fileToUpload.size > JO_MAX_FILE_BYTES) {
          throw new Error(`"${rawFile.name}" exceeds the 10MB file size limit.`);
        }

        const formData = new FormData();
        formData.append("file", fileToUpload, uploadFileName);

        const res = await fetch("/api/er/job-order/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(body.message ?? `Failed to upload "${rawFile.name}"`);
        }

        const json = (await res.json()) as { data: UploadedJobOrderFile };
        return json.data;
      } finally {
        setIsUploading(false);
      }
    },
    []
  );

  const removeStagedAttachment = useCallback(async (fileId: string): Promise<void> => {
    try {
      await fetch(`/api/er/job-order/upload?id=${encodeURIComponent(fileId)}`, {
        method: "DELETE",
      });
    } catch {
      // Best-effort cleanup of unattached staging uploads
    }
  }, []);

  return {
    isUploading,
    uploadAttachment,
    removeStagedAttachment,
  };
}

