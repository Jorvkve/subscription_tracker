import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { SubscriptionForm } from "@/components/subscription-form";
import { createSubscription } from "@/app/actions";

export default async function NewSubscriptionPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");

  return <AppShell email={session.user.email} active="subscriptions"><header className="page-header compact-header"><div><Link className="back-link" href="/subscriptions">← รายการ Subscription</Link><h1>เพิ่ม Subscription</h1><p className="muted">กำหนดรอบบิลและวันตัดรอบสำหรับรายการนี้</p></div></header><SubscriptionForm action={createSubscription}/></AppShell>;
}
