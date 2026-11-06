"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { FormActionState } from "@/app/actions";
import { formatDate } from "@/lib/dates";
import { WEEKDAY_LABELS, WORKING_WEEKDAYS, planShiftDates } from "@/lib/shift-recurrence";

type ShiftValues = {
  title: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  location?: string | null;
  notes?: string | null;
};

function RecurrenceFields({
  defaultStartDate,
  onValidityChange,
}: {
  defaultStartDate?: string;
  onValidityChange: (error: string | null) => void;
}) {
  const [startDate, setStartDate] = useState(defaultStartDate ?? "");
  const [endDate, setEndDate] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([]);

  const plan = planShiftDates({ startDate, endDate, weekdays });

  function update(next: { startDate?: string; endDate?: string; weekdays?: number[] }) {
    const nextStart = next.startDate ?? startDate;
    const nextEnd = next.endDate ?? endDate;
    const nextWeekdays = next.weekdays ?? weekdays;
    setStartDate(nextStart);
    setEndDate(nextEnd);
    setWeekdays(nextWeekdays);
    onValidityChange(planShiftDates({ startDate: nextStart, endDate: nextEnd, weekdays: nextWeekdays }).error);
  }

  function toggleWeekday(day: number, checked: boolean) {
    update({ weekdays: checked ? [...weekdays, day] : weekdays.filter((value) => value !== day) });
  }

  return (
    <>
      <label className="field">
        วันที่เริ่ม
        <input
          name="startDate"
          type="date"
          required
          value={startDate}
          onChange={(event) => update({ startDate: event.target.value })}
        />
      </label>
      <label className="field">
        วันที่สิ้นสุด (ถ้าทำซ้ำ)
        <input
          name="endDate"
          type="date"
          min={startDate || undefined}
          value={endDate}
          onChange={(event) => update({ endDate: event.target.value })}
        />
      </label>
      <fieldset className="field field-wide weekday-field">
        <legend>ทำซ้ำทุกวัน</legend>
        <div className="weekday-options">
          {WEEKDAY_LABELS.map((label, day) => (
            <label className="weekday-option" key={day}>
              <input
                type="checkbox"
                name="weekdays"
                value={day}
                checked={weekdays.includes(day)}
                onChange={(event) => toggleWeekday(day, event.target.checked)}
              />
              <span>{label}</span>
            </label>
          ))}
          <button
            className="button button-quiet button-sm"
            type="button"
            onClick={() => update({ weekdays: [...WORKING_WEEKDAYS] })}
          >
            จ-ศ
          </button>
          <button
            className="button button-quiet button-sm"
            type="button"
            onClick={() => update({ weekdays: [] })}
          >
            ล้าง
          </button>
        </div>
        <small className={plan.error ? "recurrence-preview recurrence-preview-hint" : "recurrence-preview"} aria-live="polite">
          {plan.error
            ? plan.error
            : plan.dates.length === 1
              ? `จะสร้าง 1 กะ วันที่ ${formatDate(plan.dates[0])}`
              : `จะสร้าง ${plan.dates.length} กะ ตั้งแต่ ${formatDate(plan.dates[0])} ถึง ${formatDate(plan.dates[plan.dates.length - 1])}`}
        </small>
      </fieldset>
    </>
  );
}

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
  const [recurrenceError, setRecurrenceError] = useState<string | null>(() =>
    isCreate ? planShiftDates({ startDate: values?.date ?? "", endDate: "", weekdays: [] }).error : null,
  );

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
        {isCreate ? (
          <RecurrenceFields defaultStartDate={values?.date} onValidityChange={setRecurrenceError} />
        ) : (
          <label className="field field-wide">
            วันที่
            <input name="date" type="date" required defaultValue={values?.date} />
          </label>
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
        <button className="button button-primary" type="submit" disabled={isPending || recurrenceError !== null}>
          {isPending ? "กำลังบันทึก…" : "บันทึกกะงาน"}
        </button>
      </div>
    </form>
  );
}
