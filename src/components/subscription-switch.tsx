import { setSubscriptionActive } from "@/app/actions";

/** ACTIVE/PAUSED switch; works without client JavaScript. */
export function SubscriptionSwitch({ id, name, active }: { id: string; name: string; active: boolean }) {
  return (
    <form action={setSubscriptionActive.bind(null, id, !active)}>
      <button
        className="switch"
        type="submit"
        role="switch"
        aria-checked={active}
        aria-label={`${name}: ${active ? "กำลังใช้งาน กดเพื่อพักชำระ" : "พักชำระอยู่ กดเพื่อเปิดใช้งาน"}`}
        title={active ? "พักชำระ" : "เปิดใช้งาน"}
      >
        <span className="switch-knob" />
      </button>
    </form>
  );
}
