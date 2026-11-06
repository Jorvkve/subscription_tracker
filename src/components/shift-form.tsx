"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormActionState } from "@/app/actions";

type ShiftValues = {
  title: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  location?: string | null;
  notes?: string | null;
  repeatWeeks?: number;
};

export function ShiftForm({
  action,
  values,
  isCreate = false,
}: {
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  values?: ShiftValues;
  isCreate?: boolean;
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
          ชื่องานกะ
          <input
            name="title"
            required
            maxLength={100}
            defaultValue={values?.title}
            placeholder="เช่น กะเช้า, กะบ่าย, เวรดึก"
          />
        </label>
        <label className="field">
          วันที่
          <input
            name="date"
            type="date"
            required
            defaultValue={values?.date}
          />
        </label>
        {isCreate ? (
          <label className="field">
            ทำซ้ำทุกสัปดาห์ (สัปดาห์)
            <input
              name="repeatWeeks"
              type="number"
              min={1}
              max={26}
              defaultValue={values?.repeatWeeks ?? 1}
            />
            <small>สร้างกะวันเดิมต่อเนื่องกัน 1 ถึง 26 สัปดาห์</small>
          </label>
        ) : (
          <div className="field" />
        )}
        <label className="field">
          เวลาเริ่ม
          <input
            name="startTime"
            type="time"
            required
            defaultValue={values?.startTime ?? "08:00"}
          />
        </label>
        <label className="field">
          เวลาสิ้นสุด
          <input
            name="endTime"
            type="time"
            required
            defaultValue={values?.endTime ?? "17:00"}
          />
          <small>หากเวลาสิ้นสุดน้อยกว่าเวลาเริ่ม จะถือเป็นกะข้ามคืน</small>
        </label>
        <label className="field field-wide">
          สถานที่
          <input
            name="location"
            maxLength={200}
            defaultValue={values?.location ?? ""}
            placeholder="เช่น อาคาร A ชั้น 4, สำนักงานใหญ่"
          />
        </label>
        <label className="field field-wide">
          บันทึกเพิ่มเติม
          <textarea
            name="notes"
            rows={3}
            maxLength={2000}
            defaultValue={values?.notes ?? ""}
            placeholder="หมายเหตุหรือรายละเอียดงานในกะนี้"
          />
        </label>
      </div>
      <div className="form-actions">
        <Link className="button button-quiet" href="/schedule">
          ยกเลิก
        </Link>
        <button className="button button-primary" type="submit" disabled={isPending}>
          {isPending ? "กำลังบันทึก…" : "บันทึกกะงาน"}
        </button>
      </div>
    </form>
  );
}
