import Link from "next/link";
import { ArrowLeftIcon } from "@/components/icons";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SubscriptionForm } from "@/components/subscription-form";
import { createSubscription } from "@/app/actions";

export default async function NewSubscriptionPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");

  return <><header className="page-header compact-header"><div><Link className="back-link" href="/subscriptions"><ArrowLeftIcon aria-hidden /> รายการ Subscription</Link><h1>เพิ่ม Subscription</h1><p className="muted">กำหนดรอบบิลและวันตัดรอบสำหรับรายการนี้</p></div></header><SubscriptionForm action={createSubscription}/></>;
}
