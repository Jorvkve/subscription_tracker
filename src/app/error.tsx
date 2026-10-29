"use client";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="signin-page">
      <section className="signin-card">
        <div className="brand-mark" aria-hidden="true">!</div>
        <p className="eyebrow">SOMETHING WENT WRONG</p>
        <h1>เปิดข้อมูลไม่สำเร็จ</h1>
        <p className="muted">ลองโหลดหน้านี้อีกครั้ง หากยังพบปัญหา ให้ตรวจการเชื่อมต่อฐานข้อมูล</p>
        <button className="button button-primary button-wide" onClick={reset} type="button">ลองอีกครั้ง</button>
      </section>
    </main>
  );
}
