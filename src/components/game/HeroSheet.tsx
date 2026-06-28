export function HeroSheet() {
  return (
    <aside className="hero-sheet">
      <h1>DICE<br /><span>INVOKER</span></h1>
      <h2>Guardião da Dungeon</h2>
      <h3>Slime Zelador</h3>
      <p>Defenda seu lar dos aventureiros que querem privatizar a dungeon.</p>
      <dl>
        <div><dt>⚔ Ataque</dt><dd>18</dd></div>
        <div><dt>◈ Defesa natural</dt><dd>6</dd></div>
        <div><dt>♥ Núcleo</dt><dd>28/40</dd></div>
        <div><dt>● Tesouro</dt><dd>4</dd></div>
      </dl>
      <h3>Passivas</h3>
      <p><b>Gelatina Territorial</b><br />+2 de defesa no 1º turno contra invasores.</p>
      <p><b>Recibo Pegajoso</b><br />+1 de dano após bloquear um aventureiro.</p>
    </aside>
  );
}
