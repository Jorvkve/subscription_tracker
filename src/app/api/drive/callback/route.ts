import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { encryptToken, getAuthSecret, upsertDriveConnection } from "@/lib/google-drive";

const COOKIE_NAME = "drive_oauth_state";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aBytes = Buffer.from(a, "utf8");
  const bBytes = Buffer.from(b, "utf8");
  let result = 0;
  for (let i = 0; i < aBytes.length; i++) {
    result |= aBytes[i] ^ bBytes[i];
  }
  return result === 0;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/signin");
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const cookieStore = await cookies();
  const storedState = cookieStore.get(COOKIE_NAME)?.value ?? "";
  // Clear the state cookie regardless
  cookieStore.delete(COOKIE_NAME);

  if (!state || !storedState || !timingSafeEqual(state, storedState)) {
    redirect("/slips?drive=error");
  }

  if (!code) {
    redirect("/slips?drive=error");
  }

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/drive/callback`;

  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;

  if (!clientId || !clientSecret) {
    redirect("/slips?drive=error");
  }

  // Exchange code for tokens
  let refreshToken: string | null = null;
  let tokenError = false;
  try {
    const params = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (res.ok) {
      const data = (await res.json()) as { refresh_token?: string };
      refreshToken = data.refresh_token ?? null;
    } else {
      tokenError = true;
    }
  } catch {
    tokenError = true;
  }

  if (tokenError || !refreshToken) {
    redirect("/slips?drive=error");
  }

  // Store encrypted refresh token
  let storeError = false;
  try {
    const encrypted = encryptToken(refreshToken, getAuthSecret());
    await upsertDriveConnection(encrypted);
  } catch {
    storeError = true;
  }

  if (storeError) {
    redirect("/slips?drive=error");
  }

  redirect("/slips?drive=connected");
}
