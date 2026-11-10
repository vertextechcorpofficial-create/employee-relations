import { NextResponse } from "next/server";
import {
  fetchDepartments,
  fetchEmployees,
  handleJobOrderApiError,
  resolveDecoupledActor,
} from "@/modules/er/job-order/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const actor = await resolveDecoupledActor("REQUESTER");
    if (!actor) {
      throw new Error("AUTH_DENIED: Authentication required");
    }

    const [departments, employees] = await Promise.all([
      fetchDepartments(),
      fetchEmployees(),
    ]);

    return NextResponse.json(
      { data: { departments, employees } },
      { status: 200 }
    );
  } catch (error: unknown) {
    return handleJobOrderApiError(error);
  }
}

