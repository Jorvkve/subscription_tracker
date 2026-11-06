"use client";

import { useState } from "react";

export function DeleteShiftButton({
  action,
}: {
  action: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="confirm-delete">
        <span>ลบกะงานนี้?</span>
        <form action={action}>
          <button className="button button-danger" type="submit">
            ยืนยันลบ
          </button>
        </form>
        <button
          className="button button-quiet"
          type="button"
          onClick={() => setConfirming(false)}
        >
          ยกเลิก
        </button>
      </div>
    );
  }

  return (
    <button
      className="button button-quiet"
      type="button"
      onClick={() => setConfirming(true)}
    >
      ลบกะงาน
    </button>
  );
}
