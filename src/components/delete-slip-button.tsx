"use client";

import { useState } from "react";

export function DeleteSlipButton({
  action,
  hasImage = true,
}: {
  action: () => Promise<void>;
  hasImage?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="confirm-delete">
        <span>
          {hasImage
            ? "ลบสลิปและย้ายไฟล์ไปยัง Drive Trash?"
            : "ลบสลิปนี้?"}
        </span>
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
      ลบสลิป
    </button>
  );
}
