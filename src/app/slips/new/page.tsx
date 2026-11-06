import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";
import { SlipForm } from "@/components/slip-form";
import { createSlip } from "@/app/slips/actions";
import { getPrisma } from "@/lib/prisma";

export default async function NewSlipPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");

  const prisma = getPrisma();
  const [driveConnection, subscriptions] = await Promise.all([
    prisma.driveConnection.findUnique({ where: { id: "default" }, select: { id: true } }),
    prisma.subscription.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const isConnected = !!driveConnection;

  return (
    <AppShell email={session.user.email} active="slips">
      <header className="page-header compact-header">
        <div>
          <Link className="back-link" href="/slips">
            ← สลิปค่าใช้จ่าย
          </Link>
          <h1>เพิ่มสลิปใหม่</h1>
          <p className="muted">อัปโหลดรูปสลิปและกรอกรายละเอียดการชำระเงิน</p>
        </div>
      </header>

      {!isConnected && (
        <div className="empty-callout" style={{ marginBottom: "20px" }}>
          <div className="empty-icon">📁</div>
          <div>
            <strong>ต้องเชื่อมต่อ Google Drive ก่อนเพิ่มสลิป</strong>
            <p>
              สลิปจะถูกเก็บในไฟล์ Google Drive ของคุณ{" "}
              <Link className="text-link" href="/api/drive/connect">
                เชื่อมต่อ Google Drive →
              </Link>
            </p>
          </div>
        </div>
      )}

      {isConnected ? (
        <>
          <SlipForm action={createSlip} subscriptions={subscriptions} />
          <p className="muted" style={{ marginTop: "12px" }}>
            อัปโหลดไม่ได้เพราะการเชื่อมต่อหมดอายุ?{" "}
            <Link className="text-link" href="/api/drive/connect">
              เชื่อมต่อ Google Drive ใหม่
            </Link>
          </p>
        </>
      ) : (
        <div className="form-card">
          <p className="muted" style={{ textAlign: "center", padding: "24px 0" }}>
            กรุณาเชื่อมต่อ Google Drive เพื่อเพิ่มสลิป
          </p>
        </div>
      )}
    </AppShell>
  );
}
