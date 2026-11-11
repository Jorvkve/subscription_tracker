import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { createTask } from "@/app/(app)/schedule/actions";
import { TaskForm } from "@/components/task-form";

export default async function NewTaskPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");

  return (
    <>
      <header className="page-header compact-header">
        <div>
          <h1>เพิ่มงานใหม่</h1>
          <p className="muted">สร้างงานที่ต้องทำพร้อมกำหนดวันและระดับความสำคัญ</p>
        </div>
      </header>
      <TaskForm action={createTask} />
    </>
  );
}
