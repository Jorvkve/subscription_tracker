import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ComingSoon } from "@/components/coming-soon";
import { HeroHeader, firstName } from "@/components/hero-header";

export default async function GoalsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");

  return (
    <>
      <HeroHeader title="Goals" accent="(เป้าหมายการออม)" name={firstName(session.user)} tagline="ตั้งเป้าแล้วลุยกัน 🎯" />
      <ComingSoon
        emoji="🎯"
        title="เป้าหมายการออมกำลังมา"
        description="หน้านี้ยังไม่เปิดใช้งาน เมื่อพร้อมแล้วคุณจะตั้งเป้าหมายและติดตามยอดออมได้ที่นี่"
        ideas={[
          { emoji: "✈️", title: "เป้าหมายการออม", detail: "ตั้งยอดเป้าหมาย เช่น เที่ยวญี่ปุ่น แล้วดูความคืบหน้า" },
          { emoji: "🔥", title: "สถิติการออม", detail: "นับสัปดาห์ที่ออมต่อเนื่อง" },
          { emoji: "🏆", title: "ความสำเร็จ", detail: "เหรียญรางวัลเมื่อทำเป้าได้" },
        ]}
      />
    </>
  );
}
