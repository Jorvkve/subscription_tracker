import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { auth } from "@/auth";

const COOKIE_NAME = "drive_oauth_state";
const COOKIE_MAX_AGE = 60 * 10; // 10 minutes

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/signin");
  }

  const state = crypto.randomUUID();

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/drive/callback`;

  const clientId = process.env.AUTH_GOOGLE_ID;
  if (!clientId) {
    redirect("/slips?drive=error");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/drive.file",
    access_type: "offline",
    prompt: "consent",
    state,
  });

  redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
