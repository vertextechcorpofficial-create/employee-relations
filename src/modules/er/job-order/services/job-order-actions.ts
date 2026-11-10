import {
  CreateJobOrderInput,
  CreateServiceCategoryInput,
  DecoupledActor,
  JobOrder,
  JobOrderSchema,
  ServiceCategory,
  ServiceCategorySchema,
  UpdateJobOrderStatusInput,
  UpdateServiceCategoryInput,
} from "@/modules/er/job-order/types/job-order.schema";
import {
  directusRequest,
  getManilaIsoDateTime,
  JO_COLLECTIONS,
} from "@/modules/er/job-order/services/job-order-directus";
import { fetchJobOrderById } from "@/modules/er/job-order/services/job-order-query";

/**
 * Generates a human-readable digital Job Order reference number (`JO-YYYYMMDD-XXXX`).
 */
function generateJoNumber(): string {
  const datePart = getManilaIsoDateTime().slice(0, 10).replace(/-/g, "");
  const suffix = String(Math.floor(1000 + Math.random() * 9000));
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

/**
 * Submits a new digital Job Order and links any uploaded picture/document attachments.
 * Note: Initial status is directly "Open" (no intermediate acknowledgement workflow).
 * @param {CreateJobOrderInput} input - Validated JO payload with attachments.
 * @param {DecoupledActor} actor - Decoupled requester user ID (no FK) and username.
 * @returns {Promise<JobOrder>} Newly created and hydrated Job Order.
 */
export async function createJobOrder(
  input: CreateJobOrderInput,
  actor: DecoupledActor
): Promise<JobOrder> {
  const now = getManilaIsoDateTime();
  const requestPayload = {
    jo_number: generateJoNumber(),
    category_id: input.category_id,
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

    await directusRequest<unknown>(`/items/${JO_COLLECTIONS.ATTACHMENT}`, {
      method: "POST",
      body: JSON.stringify(attachmentRows),
    });
  }

  return fetchJobOrderById(created.id);
}

/**
 * Updates the status of an existing Job Order from the Receiver POV.
 * Records the decoupled receiver user ID (no FK) and plain username.
 * @param {number} joId - Target Job Order ID.
 * @param {UpdateJobOrderStatusInput} input - New status value.
 * @param {DecoupledActor} actor - Decoupled receiver user ID and username.
 * @returns {Promise<JobOrder>} Updated and hydrated Job Order.
 */
export async function updateJobOrderStatus(
  joId: number,
  input: UpdateJobOrderStatusInput,
  actor: DecoupledActor
): Promise<JobOrder> {
  const now = getManilaIsoDateTime();
  const patchPayload = {
    status: input.status,
    receiver_user_id: actor.userId,
    receiver_username: actor.username,
    updated_at: now,
  };

  await directusRequest<unknown>(`/items/${JO_COLLECTIONS.REQUEST}/${joId}`, {
    method: "PATCH",
    body: JSON.stringify(patchPayload),
  });

  return fetchJobOrderById(joId);
}

