import { z } from "zod";
import {
  DepartmentOption,
  DepartmentOptionSchema,
  EmployeeOption,
  EmployeeOptionSchema,
  JobOrder,
  JobOrderAttachment,
  JobOrderAttachmentSchema,
  JobOrderSchema,
  ServiceCategory,
  ServiceCategorySchema,
} from "@/modules/er/job-order/types/job-order.schema";
import {
  directusRequest,
  JO_COLLECTIONS,
} from "@/modules/er/job-order/services/job-order-directus";

interface DirectusUserRow {
  user_id: number;
  user_fname?: string | null;
  user_lname?: string | null;
  user_email?: string | null;
  user_department?: number | null;
  is_deleted?: boolean | number | { type?: string; data?: number[] } | null;
}

function isUserDeleted(raw: DirectusUserRow["is_deleted"]): boolean {
  if (raw === true || raw === 1) return true;
  if (raw && typeof raw === "object" && Array.isArray(raw.data)) {
    return raw.data[0] === 1;
  }
  return false;
}

/**
 * Fetches all departments from Directus `department` for targeting Job Orders.
 * @returns {Promise<DepartmentOption[]>} Sorted list of departments.
 */
export async function fetchDepartments(): Promise<DepartmentOption[]> {
  const params = new URLSearchParams({
    fields: "department_id,department_name",
    sort: "department_name",
    limit: "-1",
  });

  const raw = await directusRequest<unknown[]>(
    `/items/department?${params.toString()}`
  );

  return z
    .array(DepartmentOptionSchema)
    .parse(Array.isArray(raw) ? raw : []);
}

/**
 * Fetches active non-deleted employees from Directus `user`.
 * @returns {Promise<EmployeeOption[]>} Sorted list of employees with department mapping.
 */
export async function fetchEmployees(): Promise<EmployeeOption[]> {
  const params = new URLSearchParams({
    fields: "user_id,user_fname,user_lname,user_email,user_department,is_deleted",
    sort: "user_fname,user_lname",
    limit: "-1",
  });

  const raw = await directusRequest<DirectusUserRow[]>(
    `/items/user?${params.toString()}`
  );

  const mapped = (Array.isArray(raw) ? raw : [])
    .filter((row) => !isUserDeleted(row.is_deleted))
    .map((row) => {
      const fullName = [row.user_fname, row.user_lname]
        .filter((part): part is string => Boolean(part && part.trim()))
        .join(" ")
        .trim();
      return {
        user_id: row.user_id,
        full_name: fullName || row.user_email || `User #${row.user_id}`,
        user_email: row.user_email ?? null,
        user_department: row.user_department ?? null,
      };
    });

  return z.array(EmployeeOptionSchema).parse(mapped);
}

/**
 * Fetches all registered service categories ordered alphabetically.
 * @param {boolean} activeOnly - Optional flag to return only active categories.
 * @returns {Promise<ServiceCategory[]>} Validated service categories list.
 */
export async function fetchServiceCategories(
  activeOnly = false
): Promise<ServiceCategory[]> {
  const params = new URLSearchParams({
    sort: "category_name",
    limit: "-1",
  });

  if (activeOnly) {
    params.set("filter[is_active][_eq]", "true");
  }

  const raw = await directusRequest<unknown[]>(
    `/items/${JO_COLLECTIONS.CATEGORY}?${params.toString()}`
  );

  return z.array(ServiceCategorySchema).parse(Array.isArray(raw) ? raw : []);
}

/**
 * Hydrates category names and attachments onto raw Job Order records
 * without relying on database foreign key joins.
 */
async function hydrateJobOrders(rawOrders: JobOrder[]): Promise<JobOrder[]> {
  if (rawOrders.length === 0) return [];

  const joIds = rawOrders.map((order) => order.id);
  const attachmentParams = new URLSearchParams({
    limit: "-1",
    sort: "id",
  });
  attachmentParams.set("filter[jo_id][_in]", joIds.join(","));

  const [categories, rawAttachments] = await Promise.all([
    fetchServiceCategories(false),
    directusRequest<unknown[]>(
      `/items/${JO_COLLECTIONS.ATTACHMENT}?${attachmentParams.toString()}`
    ),
  ]);

  const categoryMap = new Map<number, string>(
    categories.map((cat) => [cat.id, cat.category_name])
  );

  const attachments = z
    .array(JobOrderAttachmentSchema)
    .parse(Array.isArray(rawAttachments) ? rawAttachments : []);

  const attachmentsByJoId = new Map<number, JobOrderAttachment[]>();
  for (const att of attachments) {
    const existing = attachmentsByJoId.get(att.jo_id) ?? [];
    existing.push(att);
    attachmentsByJoId.set(att.jo_id, existing);
  }

  return rawOrders.map((order) => ({
    ...order,
    category_name:
      categoryMap.get(order.category_id) ?? `Category #${order.category_id}`,
    attachments: attachmentsByJoId.get(order.id) ?? [],
  }));
}

/**
 * Fetches digital Job Orders optionally scoped to a requester or target department.
 * @param {number} requesterUserId - Optional requester user ID filter.
 * @param {number} departmentId - Optional target department ID filter.
 * @returns {Promise<JobOrder[]>} Validated and hydrated Job Orders sorted newest first.
 */
export async function fetchJobOrders(
  requesterUserId?: number,
  departmentId?: number
): Promise<JobOrder[]> {
  const params = new URLSearchParams({
    sort: "-created_at,-id",
    limit: "-1",
  });

  if (requesterUserId !== undefined) {
    params.set("filter[requester_user_id][_eq]", String(requesterUserId));
  }

  if (departmentId !== undefined) {
    params.set("filter[target_department_id][_eq]", String(departmentId));
  }

  const raw = await directusRequest<unknown[]>(
    `/items/${JO_COLLECTIONS.REQUEST}?${params.toString()}`
  );

  const validated = z
    .array(JobOrderSchema)
    .parse(Array.isArray(raw) ? raw : []);

  return hydrateJobOrders(validated);
}

/**
 * Fetches a single Job Order by ID with hydrated category and attachments.
 * @param {number} joId - The numeric Job Order ID.
 * @returns {Promise<JobOrder>} The validated and hydrated Job Order.
 */
export async function fetchJobOrderById(joId: number): Promise<JobOrder> {
  const raw = await directusRequest<unknown>(
    `/items/${JO_COLLECTIONS.REQUEST}/${joId}`
  );

  if (!raw) {
    throw new Error(`DB_NOT_FOUND: Job Order #${joId} not found`);
  }

  const parsed = JobOrderSchema.parse(raw);
  const [hydrated] = await hydrateJobOrders([parsed]);
  return hydrated;
}
