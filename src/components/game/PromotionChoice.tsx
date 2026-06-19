"use client";

export type PromotionOption = Readonly<{
  id: string;
  name: string;
  die: `D${number}`;
  role: string;
  summary: string;
}>;

export function PromotionChoice({
  currentDie,
  options,
  onChoose,
}: Readonly<{
  currentDie: `D${number}`;
  options: readonly [PromotionOption, PromotionOption];
  onChoose(id: string): void;
}>) {
  return (
    <section className="promotion-backdrop" role="dialog" aria-modal="true" aria-labelledby="promotion-title">
      <div className="promotion-panel">
        <p className="promotion-kicker">{currentDie} dominado</p>
        <h2 id="promotion-title">Escolha sua nova classe</h2>
        <div className="promotion-options">
          {options.map((option, index) => (
            <article className="promotion-card" key={option.id}>
              <span className="promotion-die">{option.die}</span>
              <h3>{option.name}</h3>
              <strong>{option.role}</strong>
              <p>{option.summary}</p>
              <button autoFocus={index === 0} type="button" onClick={() => onChoose(option.id)}>
                Escolher {option.name}
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
