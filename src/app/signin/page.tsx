import { signIn } from "@/auth";

export default function SignInPage() {
  return (
    <main className="signin-page">
      <section className="signin-card">
        <div className="brand-mark" aria-hidden="true">S</div>
        <p className="eyebrow">PERSONAL FINANCE</p>
        <h1>Subscription tracker</h1>
        <p className="muted">ดูแลค่าสมาชิกรายเดือนและกำหนดชำระในที่เดียว</p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button className="button button-primary button-wide" type="submit">
            <span className="google-g" aria-hidden="true">G</span>
            เข้าสู่ระบบด้วย Google
          </button>
        </form>
        <p className="signin-footnote">สำหรับบัญชี Google ที่ได้รับอนุญาตเท่านั้น</p>
      </section>
    </main>
  );
}
