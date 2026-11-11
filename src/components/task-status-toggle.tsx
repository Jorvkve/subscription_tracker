"use client";

import { useTransition } from "react";
import type { TaskStatus } from "@/generated/prisma/client";
import { setTaskStatus } from "@/app/(app)/schedule/actions";

export function TaskStatusToggle({
  taskId,
  status,
}: {
  taskId: string;
  status: TaskStatus;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      className={`task-status-select status-${status.toLowerCase()}`}
      value={status}
      disabled={isPending}
      aria-label="เปลี่ยนสถานะงาน"
      onChange={(e) => {
        const next = e.target.value as TaskStatus;
        startTransition(async () => {
          await setTaskStatus(taskId, next);
        });
      }}
    >
      <option value="TODO">รอทำ</option>
      <option value="IN_PROGRESS">กำลังทำ</option>
      <option value="DONE">เสร็จแล้ว</option>
    </select>
  );
}
