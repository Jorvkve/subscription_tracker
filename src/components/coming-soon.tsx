/** Placeholder body for pages from the mockup that are not built yet. */
export function ComingSoon({
  emoji,
  title,
  description,
  ideas,
}: {
  emoji: string;
  title: string;
  description: string;
  ideas: { emoji: string; title: string; detail: string }[];
}) {
  return (
    <section className="panel coming-soon" aria-labelledby="coming-soon-title">
      <span className="coming-soon-emoji" aria-hidden>{emoji}</span>
      <span className="chip">เร็วๆ นี้</span>
      <h2 id="coming-soon-title" className="card-title">{title}</h2>
      <p className="muted">{description}</p>
      <ul className="coming-soon-ideas">
        {ideas.map((idea) => (
          <li key={idea.title}>
            <span aria-hidden>{idea.emoji}</span>
            <strong>{idea.title}</strong>
            <small>{idea.detail}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}
