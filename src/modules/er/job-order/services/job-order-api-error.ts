import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * Translates service/validation exceptions into standardized HTTP error responses
 * for the Job Order API gateway routes.
 */
export function handleJobOrderApiError(error: unknown): NextResponse {
  console.error("[JobOrder API Error]:", error);

  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    return NextResponse.json(
      {
        code: "VALIDATION_FAILED",
        message: firstIssue?.message ?? "Validation failed",
        issues: error.issues,
      },
      { status: 400 }
    );
  }

  const message =
    error instanceof Error ? error.message : "An unexpected error occurred";

  if (message.startsWith("VALIDATION_FAILED:")) {
    return NextResponse.json(
      { code: "VALIDATION_FAILED", message: message.replace("VALIDATION_FAILED:", "").trim() },
      { status: 400 }
    );
  }

  if (message.startsWith("AUTH_DENIED:")) {
    return NextResponse.json(
      { code: "AUTH_DENIED", message: message.replace("AUTH_DENIED:", "").trim() },
      { status: 401 }
    );
  }

  if (message.startsWith("DB_NOT_FOUND:")) {
    return NextResponse.json(
      { code: "DB_NOT_FOUND", message: message.replace("DB_NOT_FOUND:", "").trim() },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { code: "INTERNAL_FAIL", message },
    { status: 500 }
  );
}

