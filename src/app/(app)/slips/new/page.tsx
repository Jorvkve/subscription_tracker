import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon, FolderIcon } from "@/components/icons";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SlipForm } from "@/components/slip-form";
import { createSlip, readSlipImage } from "@/app/(app)/slips/actions";
import { appDateString } from "@/lib/dates";
import { getPrisma } from "@/lib/prisma";
import { isSlipOcrConfigured } from "@/lib/slip-ocr";

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
    <>
      <header className="page-header compact-header">
        <div>
          <Link className="back-link" href="/slips">
            <ArrowLeftIcon aria-hidden /> สลิปค่าใช้จ่าย
          </Link>
          <h1>เพิ่มสลิปใหม่</h1>
          <p className="muted">กรอกรายละเอียดการชำระเงิน แนบรูปสลิปหรือไม่ก็ได้ บันทึกย้อนหลังได้โดยเลือกวันที่</p>
        </div>
      </header>

      {!isConnected && (
        <div className="empty-callout stack-gap">
          <div className="empty-icon"><FolderIcon aria-hidden /></div>
          <div>
            <strong>ยังแนบรูปสลิปไม่ได้</strong>
            <p>
              บันทึกรายการโดยไม่มีรูปได้เลย ถ้าต้องการแนบรูป รูปจะเก็บใน Google Drive ของคุณ{" "}
              <Link className="text-link" href="/api/drive/connect">
                เชื่อมต่อ Google Drive <ArrowRightIcon aria-hidden />
              </Link>
            </p>
          </div>
        </div>
      )}

      <SlipForm
        action={createSlip}
        subscriptions={subscriptions}
        values={{ paidDate: appDateString() }}
        showFileField={isConnected}
        readAction={isConnected && isSlipOcrConfigured() ? readSlipImage : undefined}
      />
      {isConnected && (
        <p className="muted form-footnote">
          อัปโหลดไม่ได้เพราะการเชื่อมต่อหมดอายุ?{" "}
          <Link className="text-link" href="/api/drive/connect">
            เชื่อมต่อ Google Drive ใหม่
          </Link>
        </p>
      )}
    </>
  );
}
