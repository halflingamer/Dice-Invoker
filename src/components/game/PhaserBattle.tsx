"use client";

import { useEffect, useRef } from "react";
import { GAME_ASSETS } from "./assets";

export type BattleAnimationEvent = { id: number; type: "hit" | "reroll" };

export function PhaserBattle({ event }: { event: BattleAnimationEvent | null }) {
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{ play: (kind: BattleAnimationEvent["type"]) => void } | null>(null);

  useEffect(() => {
    let game: import("phaser").Game | undefined;
    let live = true;
    void import("phaser").then((Phaser) => {
      if (!live || !host.current) return;
      class BattleScene extends Phaser.Scene {
        hero!: Phaser.GameObjects.Sprite;
        enemy!: Phaser.GameObjects.Image;

        preload() {
          this.load.image("library", GAME_ASSETS.background);
          this.load.spritesheet("squire-idle", GAME_ASSETS.squireIdle, { frameWidth: 128, frameHeight: 128 });
          this.load.spritesheet("squire-attack", GAME_ASSETS.squireAttack, { frameWidth: 128, frameHeight: 128 });
          this.load.image("receipt-slime", GAME_ASSETS.receiptSlime);
        }

        create() {
          const { width, height } = this.scale;
          this.add.image(width / 2, height / 2, "library").setDisplaySize(width, height);
          this.anims.create({ key: "idle", frames: this.anims.generateFrameNumbers("squire-idle", { start: 0, end: 5 }), frameRate: 6, repeat: -1 });
          this.anims.create({ key: "attack", frames: this.anims.generateFrameNumbers("squire-attack", { start: 0, end: 5 }), frameRate: 12, repeat: 0 });
          this.hero = this.add.sprite(width * 0.28, height * 0.77, "squire-idle").setScale(1.35).setOrigin(0.5, 1).play("idle");
          this.enemy = this.add.image(width * 0.72, height * 0.79, "receipt-slime").setScale(0.58).setOrigin(0.5, 1);
          this.tweens.add({ targets: this.enemy, y: "-=7", duration: 850, yoyo: true, repeat: -1, ease: "Sine.inOut" });
          sceneRef.current = { play: (kind) => {
            if (kind === "hit") {
              this.hero.play("attack").once("animationcomplete", () => this.hero.play("idle"));
              this.tweens.add({ targets: this.enemy, x: "+=12", alpha: 0.45, duration: 90, yoyo: true, repeat: 1 });
            } else {
              this.tweens.add({ targets: this.hero, scale: 1.48, duration: 110, yoyo: true });
            }
          } };
        }
      }
      game = new Phaser.Game({ type: Phaser.AUTO, parent: host.current!, transparent: true, width: 900, height: 390, pixelArt: true, scene: BattleScene, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH } });
    });
    return () => { live = false; sceneRef.current = null; game?.destroy(true); };
  }, []);

  useEffect(() => { if (event) sceneRef.current?.play(event.type); }, [event]);
  return <div className="phaser-host" ref={host} aria-label="Campo de batalha: Escudeiro contra Slime de Recibo" />;
}
