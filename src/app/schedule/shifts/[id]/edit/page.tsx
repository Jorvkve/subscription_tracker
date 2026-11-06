import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { deleteShift, updateShift } from "@/app/schedule/actions";
import { AppShell } from "@/components/app-shell";
import { DeleteShiftButton } from "@/components/delete-shift-button";
import { ShiftForm } from "@/components/shift-form";
import { dateOnly } from "@/lib/dates";
import { getPrisma } from "@/lib/prisma";

export default async function EditShiftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");

  const { id } = await params;
  const shift = await getPrisma().workShift.findUnique({ where: { id } });
  if (!shift) notFound();

  const action = updateShift.bind(null, id);
  const deleteAction = deleteShift.bind(null, id);

  return (
    <AppShell email={session.user.email} active="schedule">
      <header className="page-header compact-header">
        <div>
          <h1>แก้ไขกะงาน</h1>
          <p className="muted">อัปเดตรายละเอียดของ {shift.title}</p>
        </div>
        <div className="header-actions">
          <DeleteShiftButton action={deleteAction} />
        </div>
      </header>
      <ShiftForm
        action={action}
        isCreate={false}
        values={{
          title: shift.title,
          date: dateOnly(shift.date),
          startTime: shift.startTime,
          endTime: shift.endTime,
          location: shift.location,
          notes: shift.notes,
        }}
      />
    </AppShell>
  );
}
