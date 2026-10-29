"use client";

import type { BillingUnit, SubscriptionStatus } from "@/generated/prisma/client";
import Link from "next/link";
import { useActionState } from "react";
import type { FormActionState } from "@/app/actions";

type SubscriptionValues = {
  name: string;
  category: string;
  price: string;
  currency: string;
  intervalCount: number;
  intervalUnit: BillingUnit;
  billingDay: number | null;
  nextDueDate: string;
  status: SubscriptionStatus;
  paymentMethod: string | null;
  notes: string | null;
};

const units: { value: BillingUnit; label: string }[] = [
  { value: "DAY", label: "วัน" },
  { value: "WEEK", label: "สัปดาห์" },
  { value: "MONTH", label: "เดือน" },
  { value: "YEAR", label: "ปี" },
];

export function SubscriptionForm({
  action,
  values,
}: {
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  values?: SubscriptionValues;
}) {
  const [state, formAction, isPending] = useActionState(action, {});
  return (
    <form action={formAction} className="form-card">
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <div className="form-grid">
        <label className="field field-wide">ชื่อบริการ<input name="name" required maxLength={100} defaultValue={values?.name} placeholder="เช่น iCloud+" /></label>
        <label className="field">หมวดหมู่<input name="category" defaultValue={values?.category ?? "Other"} placeholder="Cloud, Music, Video..." /></label>
        <label className="field">ราคา / รอบบิล<input name="price" type="number" min="0" step="0.01" required defaultValue={values?.price} placeholder="0.00" /></label>
        <label className="field">สกุลเงิน<input name="currency" maxLength={3} minLength={3} required defaultValue={values?.currency ?? "THB"} /></label>
        <div className="field field-wide"><span>รอบบิล</span><div className="interval-input"><input name="intervalCount" type="number" min="1" max="120" required defaultValue={values?.intervalCount ?? 1} /><select name="intervalUnit" defaultValue={values?.intervalUnit ?? "MONTH"}>{units.map((unit) => <option value={unit.value} key={unit.value}>{unit.label}</option>)}</select></div><small>ตัวอย่าง Spotify: ทุก 3 เดือน</small></div>
        <label className="field">วันตัดรอบ<input name="billingDay" type="number" min="1" max="31" defaultValue={values?.billingDay ?? ""} placeholder="เช่น 28" /></label>
        <label className="field">วันครบกำหนดถัดไป<input name="nextDueDate" type="date" required defaultValue={values?.nextDueDate} /></label>
        <label className="field">วิธีชำระเงิน<input name="paymentMethod" defaultValue={values?.paymentMethod ?? ""} placeholder="บัตรเครดิต, โอนเงิน..." /></label>
        <label className="field">สถานะ<select name="status" defaultValue={values?.status ?? "ACTIVE"}><option value="ACTIVE">กำลังใช้งาน</option><option value="PAUSED">พักชำระ</option><option value="CANCELED">ยกเลิกแล้ว</option></select></label>
        <label className="field field-wide">บันทึก<textarea name="notes" rows={3} defaultValue={values?.notes ?? ""} placeholder="รายละเอียดเพิ่มเติม" /></label>
      </div>
      <div className="form-actions"><Link className="button button-quiet" href="/subscriptions">ยกเลิก</Link><button className="button button-primary" type="submit" disabled={isPending}>{isPending ? "กำลังบันทึก…" : "บันทึก Subscription"}</button></div>
    </form>
  );
}
