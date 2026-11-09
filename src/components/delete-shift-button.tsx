"use client";

import { useState } from "react";
import type { ShiftScope } from "@/lib/shift-series";

export function DeleteShiftButton({
  action,
  options = [{ value: "this", label: "ลบกะนี้" }],
}: {
  action: (formData: FormData) => Promise<void>;
  options?: readonly { value: ShiftScope; label: string }[];
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="confirm-delete confirm-delete-scopes" role="group" aria-label="เลือกกะที่จะลบ">
        <span>{options.length > 1 ? "ลบกะไหน?" : "ลบกะงานนี้?"}</span>
        {options.map((option) => (
          <form action={action} key={option.value}>
            <input type="hidden" name="scope" value={option.value} />
            <button className="button button-danger" type="submit">
              {options.length > 1 ? option.label : "ยืนยันลบ"}
            </button>
          </form>
        ))}
        <button className="button button-quiet" type="button" onClick={() => setConfirming(false)}>
          ยกเลิก
        </button>
      </div>
    );
  }

  return (
    <button className="button button-quiet" type="button" onClick={() => setConfirming(true)}>
      ลบกะงาน
    </button>
  );
}
