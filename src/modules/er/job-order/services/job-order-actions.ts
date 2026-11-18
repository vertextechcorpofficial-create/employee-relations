import { randomUUID } from "crypto";
import {
  CreateJobOrderInput,
  CreateServiceCategoryInput,
  DecoupledActor,
  JobOrder,
  JobOrderSchema,
  ServiceCategory,
  ServiceCategorySchema,
  UpdateJobOrderInput,
  UpdateServiceCategoryInput,
} from "@/modules/er/job-order/types/job-order.schema";
import {
  directusRequest,
  getManilaIsoDateTime,
  JO_COLLECTIONS,
} from "@/modules/er/job-order/services/job-order-directus";
import {
  fetchDepartments,
  fetchEmployees,
  fetchJobOrderById,
  fetchServiceCategories,
} from "@/modules/er/job-order/services/job-order-query";

/**
 * Generates a collision-resistant digital Job Order reference number (`JO-YYYYMMDD-XXXXXX`).
 */
function generateJoNumber(): string {
  const datePart = getManilaIsoDateTime().slice(0, 10).replace(/-/g, "");
  const suffix = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `JO-${datePart}-${suffix}`;
}

/**
 * Registers a new Category of Service in `iot_jo_service_category`.
 * @param {CreateServiceCategoryInput} input - Validated category creation payload.
 * @param {DecoupledActor} actor - Decoupled user ID and plain username.
 * @returns {Promise<ServiceCategory>} Newly registered category record.
 */
export async function createServiceCategory(
  input: CreateServiceCategoryInput,
  actor: DecoupledActor
): Promise<ServiceCategory> {
  const now = getManilaIsoDateTime();
  const payload = {
    category_name: input.category_name,
    description: input.description ?? null,
    is_active: input.is_active ?? true,
    created_by_user_id: actor.userId,
    created_by_username: actor.username,
    created_at: now,
  };

  const created = await directusRequest<unknown>(
    `/items/${JO_COLLECTIONS.CATEGORY}`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );

  return ServiceCategorySchema.parse(created);
}

/**
 * Updates an existing Category of Service by ID.
 * @param {number} categoryId - Target category primary key.
 * @param {UpdateServiceCategoryInput} input - Partial category fields to update.
 * @returns {Promise<ServiceCategory>} Updated category record.
 */
export async function updateServiceCategory(
  categoryId: number,
  input: UpdateServiceCategoryInput
): Promise<ServiceCategory> {
  const updated = await directusRequest<unknown>(
    `/items/${JO_COLLECTIONS.CATEGORY}/${categoryId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );

  return ServiceCategorySchema.parse(updated);
}

async function resolveTargetRouting(
  targetDeptId: number | null,
  targetDeptName: string | null,
  targetUserId: number | null,
  targetUsername: string | null
): Promise<{
  target_department_id: number | null;
  target_department_name: string | null;
  target_user_id: number | null;
  target_username: string | null;
}> {
  let deptId = targetDeptId;
  let deptName = deptId !== null ? targetDeptName : null;
  let username = targetUserId !== null ? targetUsername : null;

  const needsLookup =
    (deptId === null && targetUserId !== null) ||
    (deptId !== null && !deptName) ||
    (targetUserId !== null && !username);

  if (needsLookup) {
    try {
      const [employees, departments] = await Promise.all([
        fetchEmployees(),
        fetchDepartments(),
      ]);
      const emp =
        targetUserId !== null
          ? employees.find((e) => e.user_id === targetUserId)
          : undefined;

      if (emp) {
        if (!username) {
          username = emp.full_name;
        }
        if (deptId === null && emp.user_department) {
          deptId = emp.user_department;
        }
      }

      if (deptId !== null && !deptName) {
        const dept = departments.find((d) => d.department_id === deptId);
        deptName = dept?.department_name ?? `Department #${deptId}`;
      }
    } catch {
      // Fallback: keep already supplied routing values if directory lookup is unavailable
    }
  }

  return {
    target_department_id: deptId,
    target_department_name: deptId !== null ? deptName : null,
    target_user_id: targetUserId,
    target_username: targetUserId !== null ? username : null,
  };
}

/**
 * Submits a new digital Job Order directed to a target department (and optional person),
 * and links uploaded picture/document attachments.
 * Note: Initial status is directly "Open" (no intermediate acknowledgement workflow).
 * @param {CreateJobOrderInput} input - Validated JO payload with routing and attachments.
 * @param {DecoupledActor} actor - Decoupled requester user ID (no FK) and username.
 * @returns {Promise<JobOrder>} Newly created and hydrated Job Order.
 */
export async function createJobOrder(
  input: CreateJobOrderInput,
  actor: DecoupledActor
): Promise<JobOrder> {
  const categories = await fetchServiceCategories(false);
  const selectedCategory = categories.find((cat) => cat.id === input.category_id);
  if (!selectedCategory) {
    throw new Error("VALIDATION_FAILED: Selected service category does not exist");
  }
  if (!selectedCategory.is_active) {
    throw new Error("VALIDATION_FAILED: Selected service category is inactive");
  }

  const now = getManilaIsoDateTime();
  const routing = await resolveTargetRouting(
    input.target_department_id ?? null,
    input.target_department_name ?? null,
    input.target_user_id ?? null,
    input.target_username ?? null
  );

  const requestPayload = {
    jo_number: generateJoNumber(),
    category_id: input.category_id,
    ...routing,
    remarks: input.remarks,
    status: "Open",
    requester_user_id: actor.userId,
    requester_username: actor.username,
    created_at: now,
    updated_at: now,
  };

  const createdRaw = await directusRequest<unknown>(
    `/items/${JO_COLLECTIONS.REQUEST}`,
    {
      method: "POST",
      body: JSON.stringify(requestPayload),
    }
  );

  const created = JobOrderSchema.parse(createdRaw);

  if (input.attachments.length > 0) {
    const attachmentRows = input.attachments.map((file) => ({
      jo_id: created.id,
      directus_file_id: file.directus_file_id,
      file_name: file.file_name,
      file_type: file.file_type ?? null,
      attachment_kind: file.attachment_kind,
      uploaded_at: now,
    }));

    try {
      await directusRequest<unknown>(`/items/${JO_COLLECTIONS.ATTACHMENT}`, {
        method: "POST",
        body: JSON.stringify(attachmentRows),
      });
    } catch (attachmentError: unknown) {
      // Compensate to prevent orphaned JO records when attachment linking fails
      try {
        await directusRequest<void>(
          `/items/${JO_COLLECTIONS.REQUEST}/${created.id}`,
          { method: "DELETE" }
        );
      } catch (rollbackError: unknown) {
        console.error("[JobOrder] Rollback after attachment error failed:", rollbackError);
      }
      throw attachmentError;
    }
  }

  return fetchJobOrderById(created.id);
}

/**
 * Updates the status and/or target routing of an existing Job Order from the Receiver POV.
 * Records the decoupled receiver user ID (no FK) and plain username.
 * @param {number} joId - Target Job Order ID.
 * @param {UpdateJobOrderInput} input - New status and/or department/person assignment.
 * @param {DecoupledActor} actor - Decoupled receiver user ID and username.
 * @returns {Promise<JobOrder>} Updated and hydrated Job Order.
 */
export async function updateJobOrder(
  joId: number,
  input: UpdateJobOrderInput,
  actor: DecoupledActor
): Promise<JobOrder> {
  const existing = await fetchJobOrderById(joId);
  const now = getManilaIsoDateTime();

  const hasRoutingChange =
    input.target_department_id !== undefined ||
    input.target_user_id !== undefined;

  const patchPayload: Record<string, unknown> = {
    receiver_user_id: actor.userId,
    receiver_username: actor.username,
    updated_at: now,
  };

  if (input.status !== undefined) {
    patchPayload.status = input.status;
  }

  if (hasRoutingChange) {
    const nextDeptId =
      input.target_department_id !== undefined
        ? input.target_department_id
        : (existing.target_department_id ?? null);
    const nextDeptName =
      input.target_department_id !== undefined
        ? (input.target_department_name ?? null)
        : (existing.target_department_name ?? null);
    const nextUserId =
      input.target_user_id !== undefined
        ? input.target_user_id
        : (existing.target_user_id ?? null);
    const nextUsername =
      input.target_user_id !== undefined
        ? (input.target_username ?? null)
        : (existing.target_username ?? null);

    if (nextDeptId === null && nextUserId === null) {
      throw new Error(
        "VALIDATION_FAILED: A Job Order must target a Department, a Personnel, or both"
      );
    }

    const resolved = await resolveTargetRouting(
      nextDeptId,
      nextDeptName,
      nextUserId,
      nextUsername
    );
    Object.assign(patchPayload, resolved);
  }

  await directusRequest<unknown>(`/items/${JO_COLLECTIONS.REQUEST}/${joId}`, {
    method: "PATCH",
    body: JSON.stringify(patchPayload),
  });

  return fetchJobOrderById(joId);
}
