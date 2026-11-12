import InkOrbitFeatures from "@/components/ui/ink-orbit-features";

// Features section for the sign-in page. It is public, so every number here is
// illustrative; nothing comes from the database.
export default function SubtrackFeatures() {
  return (
    <InkOrbitFeatures
      theme="dark"
      brand="Subtrack"
      tag="ฟีเจอร์"
      title={"รายจ่ายทุกช่องทาง\n*รวมไว้ที่เดียว*"}
      team={[
        { emoji: "🍔", label: "ข้าว 60 · ค่ากิน" },
        { emoji: "🧾", label: "สลิป · Gemini อ่านยอด" },
        { emoji: "🏠", label: "ค่าห้อง · ครบงบ" },
        { emoji: "⛽", label: "ค่าน้ำมัน · เมื่อวาน" },
        { emoji: "📺", label: "บิลรายเดือน · รอจ่าย", idle: true },
      ]}
      labels={{
        report: "สรุปประจำวัน #",
        syncing: "กำลังเชื่อม",
        connected: "เชื่อมไว้ 4 บริการ",
        forecast: "คาดการณ์",
        point: "สัปดาห์",
        predicted: "คาด",
      }}
      collaboration={{
        title: "จดรายจ่ายผ่าน Telegram",
        description:
          "พิมพ์ “ข้าว 60” หรือส่งรูปสลิปเข้าบอท แตะเลือกหมวด แล้วรายการเข้าแอปทันที ลงย้อนหลังได้ด้วยคำว่าเมื่อวานหรือวานซืน",
      }}
      reports={{
        title: "สรุปให้ทุกคืน",
        description:
          "บอทส่งรายจ่ายวันนี้ ยอดรวมทั้งเดือน งบที่เหลือ และกะงานกับบิลของพรุ่งนี้ ทุกคืนราวสามถึงสี่ทุ่ม",
      }}
      integrations={{
        title: "เชื่อมต่อในตัว",
        description:
          "Telegram รับรายการ Google Drive เก็บรูปสลิป Gemini อ่านยอดจากสลิป และอีเมลเตือนก่อนถึงวันจ่าย",
        tools: ["Telegram", "Google Drive", "Gemini", "อีเมลเตือน"],
        glyphs: ["plane", "drive", "spark", "mail"],
      }}
      insights={{
        title: "งบรายเดือนและแนวโน้ม",
        description:
          "ดูยอดใช้จ่ายสะสมเทียบกับงบของแต่ละหมวด บอทเตือนเมื่อใช้ถึง 80% และเมื่อเกินงบ",
        values: [30, 34, 33, 38, 41, 44, 46, 50, 53, 57, 60, 64],
        forecastFrom: 8,
      }}
    />
  );
}
