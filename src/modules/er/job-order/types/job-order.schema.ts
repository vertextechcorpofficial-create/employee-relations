import { z } from "zod";

/**
 * Valid digital Job Order lifecycle statuses.
 * Note: Per business rule, there is NO "Acknowledged" intermediate step.
 */
export const JO_STATUS_VALUES = [
  "Open",
  "In Progress",
  "Resolved",
  "Cancelled",
] as const;

export const JobOrderStatusEnum = z.enum(JO_STATUS_VALUES);
export type JobOrderStatus = z.infer<typeof JobOrderStatusEnum>;

export const ATTACHMENT_KIND_VALUES = ["PICTURE", "DOCUMENT"] as const;
export const AttachmentKindEnum = z.enum(ATTACHMENT_KIND_VALUES);
export type AttachmentKind = z.infer<typeof AttachmentKindEnum>;

/**
 * Coerces Directus tinyint/boolean flags (0/1 or true/false) into boolean.
 */
const booleanFlagSchema = z
  .union([z.boolean(), z.number()])
  .transform((val) => (typeof val === "number" ? val === 1 : val));

/**
 * Target Department option sourced from Directus `department`.
 */
export const DepartmentOptionSchema = z.object({
  department_id: z.number(),
  department_name: z.string().min(1),
});

export type DepartmentOption = z.infer<typeof DepartmentOptionSchema>;

/**
 * Target Employee option sourced from Directus `user` (active non-deleted users).
 */
export const EmployeeOptionSchema = z.object({
  user_id: z.number(),
  full_name: z.string().min(1),
  user_email: z.string().nullable().optional(),
  user_department: z.number().nullable().optional(),
});

export type EmployeeOption = z.infer<typeof EmployeeOptionSchema>;

/**
 * Service Category stored in `iot_jo_service_category`.
 */
export const ServiceCategorySchema = z.object({
  id: z.number(),
  category_name: z.string().min(1, "Category name is required").max(150),
  description: z.string().nullable().optional(),
  is_active: booleanFlagSchema.default(true),
  created_by_user_id: z.number().nullable().optional(),
  created_by_username: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
});

export type ServiceCategory = z.infer<typeof ServiceCategorySchema>;

export const CreateServiceCategorySchema = z.object({
  category_name: z
    .string()
    .trim()
    .min(2, "Category name must be at least 2 characters")
    .max(150, "Category name must be 150 characters or fewer"),
  description: z.string().trim().max(500).nullable().optional(),
  is_active: z.boolean().default(true),
});

export type CreateServiceCategoryInput = z.infer<typeof CreateServiceCategorySchema>;

export const UpdateServiceCategorySchema = CreateServiceCategorySchema.partial();
export type UpdateServiceCategoryInput = z.infer<typeof UpdateServiceCategorySchema>;

/**
 * Attachment item stored in `iot_jo_attachment`.
 * Supports both Pictures and Supporting Documents.
 */
export const JobOrderAttachmentSchema = z.object({
  id: z.number(),
  jo_id: z.number(),
  directus_file_id: z.string().min(1),
  file_name: z.string().min(1),
  file_type: z.string().nullable().optional(),
  attachment_kind: AttachmentKindEnum.default("DOCUMENT"),
  uploaded_at: z.string().nullable().optional(),
});

export type JobOrderAttachment = z.infer<typeof JobOrderAttachmentSchema>;

export const AttachmentDraftSchema = z.object({
  directus_file_id: z.string().min(1, "File ID is required"),
  file_name: z.string().min(1, "File name is required"),
  file_type: z.string().nullable().optional(),
  attachment_kind: AttachmentKindEnum,
});

export type AttachmentDraft = z.infer<typeof AttachmentDraftSchema>;

/**
 * Digital Job Order record stored in `iot_jo_request`.
 * Uses decoupled `user_id` and `department_id` (no FK) plus plain string names.
 */
export const JobOrderSchema = z.object({
  id: z.number(),
  jo_number: z.string().min(1),
  category_id: z.number(),
  category_name: z.string().optional(),
  remarks: z.string().min(1),
  status: JobOrderStatusEnum.default("Open"),
  requester_user_id: z.number(),
  requester_username: z.string().min(1),
  receiver_user_id: z.number().nullable().optional(),
  receiver_username: z.string().nullable().optional(),
  target_department_id: z.number().nullable().optional(),
  target_department_name: z.string().nullable().optional(),
  target_user_id: z.number().nullable().optional(),
  target_username: z.string().nullable().optional(),
  attachments: z.array(JobOrderAttachmentSchema).optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});

export type JobOrder = z.infer<typeof JobOrderSchema>;

export const CreateJobOrderSchema = z.object({
  category_id: z.number().int().positive("Please select a service category"),
  target_department_id: z
    .number()
    .int()
    .positive("Please choose a target department"),
  target_department_name: z
    .string()
    .trim()
    .min(1, "Target department name is required"),
  target_user_id: z.number().int().positive().nullable().optional(),
  target_username: z.string().trim().nullable().optional(),
  remarks: z
    .string()
    .trim()
    .min(3, "Remarks are required (at least 3 characters)")
    .max(2000, "Remarks must be 2000 characters or fewer"),
  attachments: z.array(AttachmentDraftSchema).default([]),
});

export type CreateJobOrderInput = z.infer<typeof CreateJobOrderSchema>;

export const UpdateJobOrderSchema = z
  .object({
    status: JobOrderStatusEnum.optional(),
    target_department_id: z.number().int().positive().nullable().optional(),
    target_department_name: z.string().trim().nullable().optional(),
    target_user_id: z.number().int().positive().nullable().optional(),
    target_username: z.string().trim().nullable().optional(),
  })
  .refine(
    (data) =>
      data.status !== undefined || data.target_department_id !== undefined,
    { message: "Either status or target routing must be provided" }
  );

export type UpdateJobOrderInput = z.infer<typeof UpdateJobOrderSchema>;

/**
 * Result returned by the file upload proxy endpoint.
 */
export interface UploadedJobOrderFile {
  file_id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  attachment_kind: AttachmentKind;
  filesize?: number;
}

/**
 * Decoupled actor identity extracted from session or hardcoded fallback.
 */
export interface DecoupledActor {
  userId: number;
  username: string;
}
