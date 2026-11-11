import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ComingSoon } from "@/components/coming-soon";
import { HeroHeader, firstName } from "@/components/hero-header";

export default async function PerksPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");

  return (
    <>
      <HeroHeader title="Perks" accent="/ Rewards" name={firstName(session.user)} tagline="ขยันแล้วก็ต้องได้รางวัล 🎁" />
      <ComingSoon
        emoji="🎁"
        title="สิทธิพิเศษกำลังมา"
        description="หน้านี้ยังไม่เปิดใช้งาน เมื่อพร้อมแล้วคุณจะสะสมแต้มจากการจดรายจ่ายและการออมได้ที่นี่"
        ideas={[
          { emoji: "🪙", title: "แต้มสะสม", detail: "ได้แต้มเมื่อจดรายจ่ายหรือออมตามเป้า" },
          { emoji: "🎡", title: "วงล้อประจำวัน", detail: "เช็กอินทุกวันเพื่อหมุนรับแต้ม" },
          { emoji: "🎟️", title: "รางวัลของฉัน", detail: "รวมคูปองที่แลกไว้" },
        ]}
      />
    </>
  );
}
