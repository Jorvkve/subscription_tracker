"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { TaskPriority, TaskStatus } from "@/generated/prisma/client";
import type { FormActionState } from "@/app/actions";

type TaskValues = {
  title: string;
  description?: string | null;
  dueDate?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
};

const priorities: { value: TaskPriority; label: string }[] = [
  { value: "LOW", label: "ต่ำ" },
  { value: "MEDIUM", label: "ปานกลาง" },
  { value: "HIGH", label: "สูง" },
];

const statuses: { value: TaskStatus; label: string }[] = [
  { value: "TODO", label: "รอทำ" },
  { value: "IN_PROGRESS", label: "กำลังทำ" },
  { value: "DONE", label: "เสร็จแล้ว" },
];

export function TaskForm({
  action,
  values,
}: {
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  values?: TaskValues;
}) {
  const [state, formAction, isPending] = useActionState(action, {});

  return (
    <form action={formAction} className="form-card">
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      <div className="form-grid">
        <label className="field field-wide">
          ชื่องาน
          <input
            name="title"
            required
            maxLength={200}
            defaultValue={values?.title}
            placeholder="เช่น ส่งรายงานภาษี, ตรวจเอกสารสัญญา"
          />
        </label>
        <label className="field">
          วันครบกำหนด
          <input
            name="dueDate"
            type="date"
            defaultValue={values?.dueDate ?? ""}
          />
        </label>
        <label className="field">
          ระดับความสำคัญ
          <select name="priority" defaultValue={values?.priority ?? "MEDIUM"}>
            {priorities.map((item) => (
              <option value={item.value} key={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          สถานะ
          <select name="status" defaultValue={values?.status ?? "TODO"}>
            {statuses.map((item) => (
              <option value={item.value} key={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field field-wide">
          รายละเอียดเพิ่มเติม
          <textarea
            name="description"
            rows={4}
            maxLength={2000}
            defaultValue={values?.description ?? ""}
            placeholder="ข้อมูลหรือข้อกำหนดเพิ่มเติมของงานนี้"
          />
        </label>
      </div>
      <div className="form-actions">
        <Link className="button button-quiet" href="/schedule">
          ยกเลิก
        </Link>
        <button className="button button-primary" type="submit" disabled={isPending}>
          {isPending ? "กำลังบันทึก…" : "บันทึกงาน"}
        </button>
      </div>
    </form>
  );
}
