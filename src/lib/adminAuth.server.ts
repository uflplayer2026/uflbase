function emailFromClaims(claims: unknown): string {
  const c = claims as { email?: string; user_metadata?: { email?: string } } | null;
  return (c?.email ?? c?.user_metadata?.email ?? "").toLowerCase().trim();
}

/** Server-side authorization: the verified token email must match GOOGLE_ADMIN_EMAIL. */
export function assertAdmin(claims: unknown): string {
  const configured = (process.env["GOOGLE_ADMIN_EMAIL"] ?? "").toLowerCase().trim();
  const email = emailFromClaims(claims);
  if (!configured) throw new Error("Admin access is not configured.");
  if (!email || email !== configured) throw new Error("Not authorized.");
  return email;
}
