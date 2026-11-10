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

    const currentEmployee = employees.find((e) => e.user_id === actor.userId);
    const departmentId = currentEmployee?.user_department ?? null;
    const currentDept = departments.find(
      (d) => d.department_id === departmentId
    );

    const currentUser = {
      user_id: actor.userId,
      username: currentEmployee?.full_name || actor.username,
      department_id: departmentId,
      department_name: currentDept?.department_name ?? null,
    };

    return NextResponse.json(
      { data: { departments, employees, currentUser } },
      { status: 200 }
    );
  } catch (error: unknown) {
    return handleJobOrderApiError(error);
  }
}

