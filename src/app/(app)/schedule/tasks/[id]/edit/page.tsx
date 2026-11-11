import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { deleteTask, updateTask } from "@/app/(app)/schedule/actions";
import { DeleteTaskButton } from "@/components/delete-task-button";
import { TaskForm } from "@/components/task-form";
import { dateOnly } from "@/lib/dates";
import { getPrisma } from "@/lib/prisma";

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");

  const { id } = await params;
  const task = await getPrisma().task.findUnique({ where: { id } });
  if (!task) notFound();

  const action = updateTask.bind(null, id);
  const deleteAction = deleteTask.bind(null, id);

  return (
    <>
      <header className="page-header compact-header">
        <div>
          <h1>แก้ไขงาน</h1>
          <p className="muted">อัปเดตรายละเอียดของ {task.title}</p>
        </div>
        <div className="header-actions">
          <DeleteTaskButton action={deleteAction} />
        </div>
      </header>
      <TaskForm
        action={action}
        values={{
          title: task.title,
          description: task.description,
          dueDate: task.dueDate ? dateOnly(task.dueDate) : null,
          priority: task.priority,
          status: task.status,
        }}
      />
    </>
  );
}
