import { cookies } from "next/headers";
import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { DecoupledActor } from "@/modules/er/job-order/types/job-order.schema";

export type ActorRoleContext = "REQUESTER" | "RECEIVER";

const HARDCODED_FALLBACKS: Record<ActorRoleContext, DecoupledActor> = {
  REQUESTER: { userId: 24, username: "Andrei Siapno" },
  RECEIVER: { userId: 24, username: "Andrei Siapno" },
};

function pickNonEmptyString(
  obj: Record<string, unknown> | null,
  keys: string[]
): string | null {
  if (!obj) return null;
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "string" && val.trim().length > 0) {
      return val.trim();
    }
  }
  return null;
}

function pickPositiveInt(
  obj: Record<string, unknown> | null,
  keys: string[]
): number | null {
  if (!obj) return null;
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "number" && Number.isFinite(val) && val > 0) {
      return Math.trunc(val);
    }
    if (typeof val === "string" && val.trim().length > 0) {
      const parsed = Number(val);
      if (Number.isFinite(parsed) && parsed > 0) {
        return Math.trunc(parsed);
      }
    }
  }
  return null;
}

/**
 * Resolves the decoupled actor identity (`userId` with no FK + plain `username`).
 * Uses the active JWT session when present, or falls back to a hardcoded identity
 * when `NEXT_PUBLIC_AUTH_DISABLED === "true"`.
 * Returns `null` when unauthenticated and auth bypass is disabled.
 */
export async function resolveDecoupledActor(
  roleContext: ActorRoleContext = "REQUESTER"
): Promise<DecoupledActor | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const isAuthDisabled = process.env.NEXT_PUBLIC_AUTH_DISABLED === "true";

  if (!token) {
    return isAuthDisabled ? HARDCODED_FALLBACKS[roleContext] : null;
  }

  const payload = decodeJwtPayload(token);
  const userId = pickPositiveInt(payload, ["user_id", "userId", "id", "sub"]);

  if (!userId) {
    return isAuthDisabled ? HARDCODED_FALLBACKS[roleContext] : null;
  }

  const firstName = pickNonEmptyString(payload, [
    "Firstname",
    "FirstName",
    "firstName",
    "firstname",
    "first_name",
  ]);
  const lastName = pickNonEmptyString(payload, [
    "LastName",
    "Lastname",
    "lastName",
    "lastname",
    "last_name",
  ]);
  const explicitUsername = pickNonEmptyString(payload, [
    "username",
    "userName",
    "email",
    "Email",
  ]);

  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const username =
    fullName || explicitUsername || HARDCODED_FALLBACKS[roleContext].username;

  return { userId, username };
}

