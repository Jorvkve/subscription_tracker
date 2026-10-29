"use client";

import { useState } from "react";

export function DeleteSubscriptionButton({
  action,
}: {
  action: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="confirm-delete">
        <span>ลบรายการและประวัติการจ่าย?</span>
        <form action={action}><button className="button button-danger" type="submit">ยืนยันลบ</button></form>
        <button className="button button-quiet" type="button" onClick={() => setConfirming(false)}>ยกเลิก</button>
      </div>
    );
  }

  return <button className="button button-quiet" type="button" onClick={() => setConfirming(true)}>ลบรายการ</button>;
}
