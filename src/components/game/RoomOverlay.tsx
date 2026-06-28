"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function RoomOverlay({
  title,
  eyebrow,
  gold,
  heroHp,
  heroMaxHp,
  essence,
  children,
}: Readonly<{
  title: string;
  eyebrow: string;
  gold: number;
  heroHp: number;
  heroMaxHp: number;
  essence: number;
  children: ReactNode;
}>) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="room-backdrop">
      <section className="room-overlay" role="dialog" aria-modal="true" aria-labelledby="room-overlay-title">
        <header className="room-overlay-header">
          <div>
            <span>{eyebrow}</span>
            <h2 id="room-overlay-title" ref={headingRef} tabIndex={-1}>{title}</h2>
          </div>
          <dl className="room-resources" aria-label="Recursos da dungeon">
            <div><dt>Núcleo</dt><dd>♥ {heroHp}/{heroMaxHp}</dd></div>
            <div><dt>Tesouro</dt><dd>● {gold}</dd></div>
            <div><dt>Essência</dt><dd>◆ {essence}</dd></div>
          </dl>
        </header>
        <div className="room-overlay-content">{children}</div>
      </section>
    </div>
  );
}
