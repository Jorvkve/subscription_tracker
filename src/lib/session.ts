import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");
  return session;
}
