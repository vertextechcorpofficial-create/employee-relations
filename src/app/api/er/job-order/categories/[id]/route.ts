import { NextRequest, NextResponse } from "next/server";
import { UpdateServiceCategorySchema } from "@/modules/er/job-order/types/job-order.schema";
import {
  handleJobOrderApiError,
  resolveDecoupledActor,
  updateServiceCategory,
} from "@/modules/er/job-order/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const actor = await resolveDecoupledActor("REQUESTER");
    if (!actor) {
      throw new Error("AUTH_DENIED: Authentication required");
    }

    const { id } = await context.params;
    const categoryId = Number(id);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      throw new Error("VALIDATION_FAILED: Invalid category ID");
    }

    const body: unknown = await request.json();
    const parsed = UpdateServiceCategorySchema.parse(body);
    const updated = await updateServiceCategory(categoryId, parsed);

    return NextResponse.json({ data: updated }, { status: 200 });
  } catch (error: unknown) {
    return handleJobOrderApiError(error);
  }
}

