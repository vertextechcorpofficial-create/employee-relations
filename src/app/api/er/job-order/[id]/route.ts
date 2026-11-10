import { NextRequest, NextResponse } from "next/server";
import { UpdateJobOrderSchema } from "@/modules/er/job-order/types/job-order.schema";
import {
  fetchJobOrderById,
  handleJobOrderApiError,
  resolveDecoupledActor,
  updateJobOrder,
} from "@/modules/er/job-order/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseNumericId(rawId: string): number {
  const parsed = Number(rawId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("VALIDATION_FAILED: Invalid Job Order ID");
  }
  return parsed;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const actor = await resolveDecoupledActor("REQUESTER");
    if (!actor) {
      throw new Error("AUTH_DENIED: Authentication required");
    }

    const { id } = await context.params;
    const joId = parseNumericId(id);
    const data = await fetchJobOrderById(joId);

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    return handleJobOrderApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const actor = await resolveDecoupledActor("RECEIVER");
    if (!actor) {
      throw new Error("AUTH_DENIED: Authentication required");
    }

    const { id } = await context.params;
    const joId = parseNumericId(id);
    const body: unknown = await request.json();
    const parsed = UpdateJobOrderSchema.parse(body);

    const updated = await updateJobOrder(joId, parsed, actor);
    return NextResponse.json({ data: updated }, { status: 200 });
  } catch (error: unknown) {
    return handleJobOrderApiError(error);
  }
}
