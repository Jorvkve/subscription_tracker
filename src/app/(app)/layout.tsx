import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";

// Shared by every signed-in page, so the sidebar and phone bar stay put while pages change.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");
  return <AppShell email={session.user.email}>{children}</AppShell>;
}
