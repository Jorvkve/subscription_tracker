"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import type { FormActionState } from "@/app/actions";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";
import { MAX_SLIP_BYTES } from "@/lib/slip-input";

type SlipFormValues = {
  amount?: string;
  currency?: string;
  paidDate?: string;
  paidTime?: string | null;
  payee?: string | null;
  category?: string;
  note?: string | null;
  subscriptionId?: string | null;
};

type Subscription = {
  id: string;
  name: string;
};

export function SlipForm({
  action,
  values,
  subscriptions,
  showFileField = true,
}: {
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  values?: SlipFormValues;
  subscriptions: Subscription[];
  showFileField?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(action, {});
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setFileError(null);
      return;
    }
    if (file.size > MAX_SLIP_BYTES) {
      setFileError("ขนาดไฟล์ต้องไม่เกิน 4 MB");
      if (fileRef.current) fileRef.current.value = "";
    } else {
      setFileError(null);
    }
  }

  return (
    <form action={formAction} className="form-card">
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      <div className="form-grid">
        {showFileField && (
          <label className="field field-wide">
            รูปสลิปการชำระเงิน
            <input
              ref={fileRef}
              name="slipFile"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required={showFileField}
              onChange={handleFileChange}
            />
            {fileError && (
              <small className="text-danger">{fileError}</small>
            )}
            <small>รองรับ JPEG, PNG, WebP ขนาดไม่เกิน 4 MB</small>
          </label>
        )}
        <label className="field">
          จำนวนเงิน
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            max="1000000000"
            required
            defaultValue={values?.amount ?? ""}
            placeholder="เช่น 150.00"
          />
        </label>
        <label className="field">
          สกุลเงิน
          <input
            name="currency"
            maxLength={3}
            required
            defaultValue={values?.currency ?? "THB"}
            placeholder="THB"
          />
        </label>
        <label className="field">
          วันที่ชำระ
          <input
            name="paidDate"
            type="date"
            required
            defaultValue={values?.paidDate ?? ""}
          />
        </label>
        <label className="field">
          เวลาที่ชำระ (ไม่บังคับ)
          <input
            name="paidTime"
            type="time"
            defaultValue={values?.paidTime ?? ""}
            placeholder="HH:mm"
          />
        </label>
        <label className="field">
          ผู้รับเงิน / ร้านค้า
          <input
            name="payee"
            maxLength={200}
            defaultValue={values?.payee ?? ""}
            placeholder="เช่น ร้าน 7-Eleven"
          />
        </label>
        <label className="field">
          หมวดหมู่
          <input
            name="category"
            maxLength={100}
            defaultValue={values?.category ?? ""}
            placeholder="เช่น Food, Entertainment"
            list="expense-category-suggestions"
          />
          <datalist id="expense-category-suggestions">
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat.key} value={cat.label} />
            ))}
          </datalist>
        </label>
        <label className="field field-wide">
          Subscription ที่เกี่ยวข้อง (ไม่บังคับ)
          <select name="subscriptionId" defaultValue={values?.subscriptionId ?? ""}>
            <option value="">— ไม่ระบุ —</option>
            {subscriptions.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field field-wide">
          บันทึกเพิ่มเติม
          <textarea
            name="note"
            rows={3}
            maxLength={2000}
            defaultValue={values?.note ?? ""}
            placeholder="รายละเอียดเพิ่มเติมของการชำระเงินนี้"
          />
        </label>
      </div>
      <div className="form-actions">
        <Link className="button button-quiet" href="/slips">
          ยกเลิก
        </Link>
        <button
          className="button button-primary"
          type="submit"
          disabled={isPending || fileError !== null}
        >
          {isPending ? "กำลังบันทึก…" : "บันทึกสลิป"}
        </button>
      </div>
    </form>
  );
}
