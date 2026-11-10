import { NextRequest, NextResponse } from "next/server";
import { CreateJobOrderSchema } from "@/modules/er/job-order/types/job-order.schema";
import {
  createJobOrder,
  fetchJobOrders,
  handleJobOrderApiError,
  resolveDecoupledActor,
} from "@/modules/er/job-order/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await resolveDecoupledActor("REQUESTER");
    if (!actor) {
      throw new Error("AUTH_DENIED: Authentication required");
    }

    const scope = request.nextUrl.searchParams.get("scope") ?? "all";
    const rawDeptId = request.nextUrl.searchParams.get("departmentId");
    const parsedDeptId =
      rawDeptId && Number.isInteger(Number(rawDeptId)) && Number(rawDeptId) > 0
        ? Number(rawDeptId)
        : undefined;

    const data =
      scope === "my"
        ? await fetchJobOrders(actor.userId, parsedDeptId)
        : await fetchJobOrders(undefined, parsedDeptId);

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    return handleJobOrderApiError(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const actor = await resolveDecoupledActor("REQUESTER");
    if (!actor) {
      throw new Error("AUTH_DENIED: Authentication required");
    }

    const body: unknown = await request.json();
    const parsed = CreateJobOrderSchema.parse(body);
    const created = await createJobOrder(parsed, actor);

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error: unknown) {
    return handleJobOrderApiError(error);
  }
}
