import type { CategorySpend } from "@/lib/dashboard";
import { categoryEmoji } from "@/lib/dashboard";

const colors = ["var(--lime)", "var(--blue)", "var(--purple)", "var(--pink)", "var(--yellow)", "var(--orange)"];
const radius = 42;
const circumference = 2 * Math.PI * radius;

/** Donut of spending by category with a legend; top five slices, the rest grouped. */
export function SpendDonut({
  categories,
  centre,
  emoji = false,
  className = "",
}: {
  categories: CategorySpend[];
  centre?: string;
  emoji?: boolean;
  className?: string;
}) {
  const slices = categories.length > 5
    ? [...categories.slice(0, 4), { key: "rest", label: "อื่นๆ", amount: 0, share: categories.slice(4).reduce((sum, item) => sum + item.share, 0) }]
    : categories;
  const arcs = slices.map((slice, index) => ({
    ...slice,
    color: colors[index % colors.length],
    length: slice.share * circumference,
    offset: slices.slice(0, index).reduce((sum, item) => sum + item.share * circumference, 0),
  }));
  const label = categories.length
    ? `สัดส่วนค่าใช้จ่าย: ${categories.map((item) => `${item.label} ${Math.round(item.share * 100)}%`).join(", ")}`
    : "ยังไม่มีค่าใช้จ่าย";

  return (
    <div className={`donut-wrap${categories.length ? "" : " donut-empty"} ${className}`}>
      <svg className="donut" viewBox="0 0 100 100" role="img" aria-label={label}>
        <circle className="donut-track" cx="50" cy="50" r={radius} />
        {arcs.map((arc) => (
          <circle
            key={arc.key}
            cx="50" cy="50" r={radius}
            stroke={arc.color}
            strokeDasharray={`${arcs.length > 1 ? Math.max(arc.length - 1.5, 0) : arc.length} ${circumference}`}
            strokeDashoffset={-arc.offset}
          />
        ))}
      </svg>
      {centre && <span className="donut-center" aria-hidden>{centre}</span>}
      {arcs.length > 0 && (
        <ul className="donut-legend">
          {arcs.map((arc) => (
            <li key={arc.key}>
              <i style={{ background: arc.color }} />
              {arc.label}{emoji && arc.key !== "rest" ? ` ${categoryEmoji(arc.key)}` : ""}
              <b>{Math.round(arc.share * 100)}%</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
