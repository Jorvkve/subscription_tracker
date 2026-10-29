import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { updateSubscription } from "@/app/actions";
import { AppShell } from "@/components/app-shell";
import { SubscriptionForm } from "@/components/subscription-form";
import { dateOnly } from "@/lib/dates";
import { getPrisma } from "@/lib/prisma";

export default async function EditSubscriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");
  const { id } = await params;
  const subscription = await getPrisma().subscription.findUnique({ where: { id } });
  if (!subscription) notFound();

  const action = updateSubscription.bind(null, id);
  return <AppShell email={session.user.email} active="subscriptions"><header className="page-header compact-header"><div><h1>แก้ไขรายการ</h1><p className="muted">อัปเดตรายละเอียดและวันครบกำหนดของ {subscription.name}</p></div></header><SubscriptionForm action={action} values={{...subscription, price: subscription.price.toString(), nextDueDate: dateOnly(subscription.nextDueDate)}}/></AppShell>;
}
