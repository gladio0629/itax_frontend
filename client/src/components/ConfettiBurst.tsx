const COLORS = ["bg-brand-yellow", "bg-accent", "bg-danger", "bg-warning"];
const COUNT = 14;

const particles = Array.from({ length: COUNT }, (_, i) => {
  const angle = (i / COUNT) * Math.PI * 2;
  const distance = 60 + (i % 3) * 20;
  return {
    cx: `${Math.round(Math.cos(angle) * distance)}px`,
    cy: `${Math.round(Math.sin(angle) * distance)}px`,
    color: COLORS[i % COLORS.length],
    delay: `${(i % 5) * 20}ms`,
  };
});

/** CSS-only particle burst (transform/opacity only). Mount with a fresh
 * `key` to replay. */
export function ConfettiBurst() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
      {particles.map((p, i) => (
        <span
          key={i}
          className={`confetti-particle absolute h-2 w-2 rounded-full ${p.color}`}
          style={{ "--cx": p.cx, "--cy": p.cy, animationDelay: p.delay } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
