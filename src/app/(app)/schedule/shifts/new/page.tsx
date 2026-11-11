import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createShifts } from "@/app/(app)/schedule/actions";
import { ShiftForm } from "@/components/shift-form";
import { appDateString } from "@/lib/dates";

export default async function NewShiftPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");

  const today = appDateString();

  return (
    <>
      <header className="page-header compact-header">
        <div>
          <h1>เพิ่มกะงานใหม่</h1>
          <p className="muted">กำหนดวันเริ่มต้น วันสิ้นสุด และวันในสัปดาห์ที่ต้องการทำซ้ำ</p>
        </div>
      </header>
      <ShiftForm
        action={createShifts}
        isCreate={true}
        values={{
          title: "",
          date: today,
          startTime: "08:00",
          endTime: "17:00",
        }}
      />
    </>
  );
}
