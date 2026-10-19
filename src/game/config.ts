import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { COLORS, VIEWPORT } from './gameConfig';

export function createGame(parent: string): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    width: VIEWPORT.width,
    height: VIEWPORT.height,
    backgroundColor: COLORS.background,
    scene: [GameScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  };

  return new Phaser.Game(config);
}
