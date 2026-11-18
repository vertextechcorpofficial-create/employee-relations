import { NextRequest, NextResponse } from "next/server";
import { CreateServiceCategorySchema } from "@/modules/er/job-order/types/job-order.schema";
import {
  createServiceCategory,
  fetchServiceCategories,
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

    const activeOnly =
      request.nextUrl.searchParams.get("activeOnly") === "true";
    const data = await fetchServiceCategories(activeOnly);

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
    const parsed = CreateServiceCategorySchema.parse(body);
    const created = await createServiceCategory(parsed, actor);

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error: unknown) {
    return handleJobOrderApiError(error);
  }
}

