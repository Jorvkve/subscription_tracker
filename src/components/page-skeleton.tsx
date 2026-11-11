/**
 * Placeholder shown by each route's loading.tsx while the server renders the page.
 * It appears the moment a link is tapped (and is prefetched), inside the shell that stays put.
 * `columns` lists the card heights per column on wide screens; phones stack them.
 */
export function PageSkeleton({ columns }: { columns: readonly (readonly number[])[] }) {
  return (
    <div className="skeleton-page" aria-busy="true" aria-live="polite">
      <span className="sr-only">กำลังโหลด…</span>
      <div className="skeleton-hero" aria-hidden>
        <span className="skeleton-block skeleton-line-sm" />
        <span className="skeleton-block skeleton-line-lg" />
      </div>
      <div className="skeleton-grid" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }} aria-hidden>
        {columns.map((cards, column) => (
          <div className="skeleton-col" key={column}>
            {cards.map((height, index) => (
              <div className="panel skeleton-card" style={{ height }} key={index}>
                <span className="skeleton-block skeleton-line-md" />
                <span className="skeleton-block skeleton-line-xl" />
                <span className="skeleton-block skeleton-fill" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
