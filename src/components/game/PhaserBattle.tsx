"use client";

import { useEffect, useRef } from "react";
import { GAME_ASSETS } from "./assets";

export type BattleAnimationEvent = { id: number; type: "hit" | "enemy-hit" | "reroll" };
export type EnemyRank = "normal" | "elite" | "boss";

const ENEMY_TEXTURE: Record<EnemyRank, string> = {
  normal: "receipt-slime",
  elite: "receipt-slime-elite",
  boss: "receipt-slime-boss",
};

export function PhaserBattle({
  event,
  enemyRank = "normal",
  guardianName = "Slime Zelador",
  invaderName = "Escudeiro Invasor",
}: Readonly<{
  event: BattleAnimationEvent | null;
  enemyRank?: EnemyRank;
  guardianName?: string;
  invaderName?: string;
}>) {
  const host = useRef<HTMLDivElement>(null);
  const initialEnemyRank = useRef(enemyRank);
  const sceneRef = useRef<{
    play: (kind: BattleAnimationEvent["type"]) => void;
    setEnemyRank: (rank: EnemyRank) => void;
  } | null>(null);

  useEffect(() => {
    let game: import("phaser").Game | undefined;
    let live = true;
    void import("phaser").then((Phaser) => {
      if (!live || !host.current) return;
      class BattleScene extends Phaser.Scene {
        guardian!: Phaser.GameObjects.Image;
        invader!: Phaser.GameObjects.Sprite;

        preload() {
          this.load.image("library", GAME_ASSETS.background);
          this.load.spritesheet("squire-idle", GAME_ASSETS.squireIdle, { frameWidth: 128, frameHeight: 128 });
          this.load.spritesheet("squire-attack", GAME_ASSETS.squireAttack, { frameWidth: 128, frameHeight: 128 });
          this.load.image("receipt-slime", GAME_ASSETS.receiptSlime);
          this.load.image("receipt-slime-elite", GAME_ASSETS.receiptSlimeElite);
          this.load.image("receipt-slime-boss", GAME_ASSETS.receiptSlimeBoss);
        }

        create() {
          const { width, height } = this.scale;
          this.add.image(width / 2, height / 2, "library").setDisplaySize(width, height);
          this.anims.create({ key: "idle", frames: this.anims.generateFrameNumbers("squire-idle", { start: 0, end: 5 }), frameRate: 6, repeat: -1 });
          this.anims.create({ key: "attack", frames: this.anims.generateFrameNumbers("squire-attack", { start: 0, end: 5 }), frameRate: 12, repeat: 0 });
          this.guardian = this.add.image(width * 0.28, height * 0.79, ENEMY_TEXTURE[initialEnemyRank.current]).setScale(0.58).setOrigin(0.5, 1);
          this.invader = this.add.sprite(width * 0.72, height * 0.77, "squire-idle").setScale(1.35).setFlipX(true).setOrigin(0.5, 1).play("idle");
          this.tweens.add({ targets: this.guardian, y: "-=7", duration: 850, yoyo: true, repeat: -1, ease: "Sine.inOut" });
          sceneRef.current = { play: (kind) => {
            if (kind === "hit") {
              this.tweens.add({ targets: this.guardian, x: "+=34", duration: 130, yoyo: true, ease: "Quad.out" });
              this.tweens.add({ targets: this.invader, x: "+=12", alpha: 0.45, duration: 90, yoyo: true, repeat: 1 });
            } else if (kind === "enemy-hit") {
              this.invader.play("attack").once("animationcomplete", () => this.invader.play("idle"));
              this.tweens.add({
                targets: this.invader,
                x: "-=48",
                duration: 120,
                yoyo: true,
                ease: "Quad.out",
              });
              this.tweens.add({
                targets: this.guardian,
                x: "-=10",
                alpha: 0.55,
                duration: 80,
                yoyo: true,
                repeat: 1,
              });
            } else {
              this.tweens.add({ targets: this.guardian, scale: 0.66, duration: 110, yoyo: true });
            }
          }, setEnemyRank: (rank) => this.guardian.setTexture(ENEMY_TEXTURE[rank]) };
        }
      }
      game = new Phaser.Game({ type: Phaser.AUTO, parent: host.current!, transparent: true, width: 900, height: 390, pixelArt: true, scene: BattleScene, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH } });
    });
    return () => { live = false; sceneRef.current = null; game?.destroy(true); };
  }, []);

  useEffect(() => { if (event) sceneRef.current?.play(event.type); }, [event]);
  useEffect(() => { sceneRef.current?.setEnemyRank(enemyRank); }, [enemyRank]);
  return <div className="phaser-host" ref={host} aria-label={`Campo de batalha: ${guardianName} contra ${invaderName}`} />;
}
