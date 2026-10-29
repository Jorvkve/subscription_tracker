export function isAllowedGoogleAccount(
  email: string | null | undefined,
  emailVerified: boolean,
  configuredAllowlist: string | undefined,
): boolean {
  if (!email || !emailVerified || !configuredAllowlist?.trim()) return false;

  const allowedEmails = new Set(
    configuredAllowlist
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );

  return allowedEmails.has(email.trim().toLowerCase());
}
