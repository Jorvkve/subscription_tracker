import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { SIDEBAR_COOKIE } from "@/lib/sidebar";
import { SubscriptionStatus } from "@/generated/prisma/client";
import { addDays, appDateString } from "@/lib/dates";
import { getPrisma } from "@/lib/prisma";

// Shared by every signed-in page, so the sidebar and phone bar stay put while pages change.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");
  const [cookieStore, subsDueSoon] = await Promise.all([
    cookies(),
    // Active subscriptions overdue or due within three days, for the badge on the Subs tab.
    getPrisma().subscription.count({
      where: {
        status: SubscriptionStatus.ACTIVE,
        nextDueDate: { lte: new Date(`${addDays(appDateString(), 3)}T00:00:00.000Z`) },
      },
    }),
  ]);
  return (
    <AppShell
      email={session.user.email}
      sidebarCollapsed={cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed"}
      badges={{ "/subscriptions": subsDueSoon }}
    >
      {children}
    </AppShell>
  );
}
