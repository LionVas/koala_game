import Phaser from 'phaser';
import koalaUrl from '../../Koala.png?url';

const INITIAL_GOAL = 300;
const GOAL_INCREMENT = 300;
const IP_CHANGE_COST_RATE = 0.1;
const STARTING_REWARD = 1;
const UPGRADE_COST = 10;
const UPGRADE_COST_GROWTH = 1.6;
const PHASE_TWO_START_EARNED = 150;
const PHASE_TWO_UPGRADE_MULTIPLIER = 1.5;
const FIRST_EVENT_DELAY_MS = 12_000;
const BETWEEN_EVENTS_MS = 11_000;
const PHASE_TWO_BETWEEN_EVENTS_MS = 6_000;
const OVERSELLING_DURATION_MS = 7_000;
const IP_BLOCK_DURATION_MS = 5_000;

type EventType = 'overselling' | 'ipBlock';

export class GameScene extends Phaser.Scene {
  private balance = 0;
  private earned = 0;
  private upgrades = 0;
  private currentGoal = INITIAL_GOAL;
  private phase: 1 | 2 = 1;
  private activeEvent: EventType | null = null;
  private nextEvent: EventType = 'overselling';
  private isPaused = false;
  private lastSecondsShown = -1;
  private eventTimer: Phaser.Time.TimerEvent | null = null;

  private balanceText!: Phaser.GameObjects.Text;
  private rewardText!: Phaser.GameObjects.Text;
  private goalText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;
  private eventText!: Phaser.GameObjects.Text;
  private upgradeText!: Phaser.GameObjects.Text;
  private buyButton!: Phaser.GameObjects.Rectangle;
  private buyButtonText!: Phaser.GameObjects.Text;
  private changeIpButton!: Phaser.GameObjects.Rectangle;
  private changeIpButtonText!: Phaser.GameObjects.Text;
  private pauseOverlay!: Phaser.GameObjects.Container;

  constructor() {
    super('GameScene');
  }

  preload(): void {
    this.load.image('koala', koalaUrl);
  }

  create(): void {
    this.balance = 0;
    this.earned = 0;
    this.upgrades = 0;
    this.currentGoal = INITIAL_GOAL;
    this.phase = 1;
    this.activeEvent = null;
    this.nextEvent = 'overselling';
    this.isPaused = false;
    this.time.paused = false;
    this.tweens.paused = false;
    this.eventTimer = null;
    this.lastSecondsShown = -1;

    this.add.text(40, 24, 'КОАЛА-ХОСТИНГ', {
      fontFamily: 'system-ui, sans-serif', fontSize: '32px', color: '#f8fafc', fontStyle: 'bold',
    });
    this.add.text(42, 75, 'Кликай по коале и покупай мощности.', {
      fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#94a3b8',
    });
    this.add.rectangle(453, 43, 176, 40, 0x1e293b).setStrokeStyle(1, 0x334155);
    this.phaseText = this.add.text(453, 43, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#93c5fd', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(560, 76, `От ${PHASE_TWO_START_EARNED} очков начинается вторая фаза: цены ×${PHASE_TWO_UPGRADE_MULTIPLIER}, помехи чаще`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#94a3b8',
    });

    const restartButton = this.add.rectangle(828, 43, 184, 40, 0x475569);
    restartButton.setInteractive({ useHandCursor: true });
    restartButton.on('pointerdown', () => this.scene.restart());
    this.add.text(828, 43, 'Начать заново', {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#ffffff',
    }).setOrigin(0.5);

    const valueStyle = {
      fontFamily: 'system-ui, sans-serif', fontSize: '26px', color: '#ffffff', fontStyle: 'bold',
    };
    this.addStatCard(40, 'БАЛАНС');
    this.addStatCard(345, 'ЗА КЛИК');
    this.addStatCard(650, 'ЦЕЛЬ');
    this.balanceText = this.add.text(58, 138, '', valueStyle);
    this.rewardText = this.add.text(363, 138, '', valueStyle);
    this.goalText = this.add.text(668, 138, '', valueStyle);

    this.add.rectangle(480, 234, 880, 54, 0x1e293b).setStrokeStyle(1, 0x334155);
    this.eventText = this.add.text(58, 218, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#cbd5e1',
    });
    this.changeIpButton = this.add.rectangle(798, 234, 220, 40, 0x2563eb);
    this.changeIpButton.on('pointerdown', () => this.changeIp());
    this.changeIpButtonText = this.add.text(798, 234, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);

    const koala = this.add.image(263, 429, 'koala').setDisplaySize(300, 300);
    koala.setInteractive({ useHandCursor: true });
    koala.on('pointerdown', () => this.clickKoala());
    this.add.text(263, 591, 'Нажми на коалу', {
      fontFamily: 'system-ui, sans-serif', fontSize: '19px', color: '#cbd5e1',
    }).setOrigin(0.5);

    this.add.rectangle(704, 443, 352, 324, 0x1e293b).setStrokeStyle(1, 0x334155);
    this.add.text(552, 306, 'ВЫЧИСЛИТЕЛЬНАЯ МОЩНОСТЬ', {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#f8fafc', fontStyle: 'bold',
    });
    this.add.text(552, 352, 'Каждая покупка даёт +1 очко за клик.', {
      fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#cbd5e1',
    });
    this.upgradeText = this.add.text(552, 399, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '19px', color: '#e2e8f0',
    });
    this.buyButton = this.add.rectangle(704, 527, 304, 64, 0x2563eb);
    this.buyButton.setInteractive({ useHandCursor: true });
    this.buyButton.on('pointerdown', () => this.buyUpgrade());
    this.buyButtonText = this.add.text(704, 527, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: '19px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.createPauseControls();
    this.refreshDisplay();
    this.eventTimer = this.time.delayedCall(FIRST_EVENT_DELAY_MS, () => this.startEvent());
  }

  update(): void {
    if (this.isPaused || !this.activeEvent || !this.eventTimer) return;

    const seconds = Math.max(0, Math.ceil(this.eventTimer.getRemaining() / 1000));
    if (seconds === this.lastSecondsShown) return;
    this.lastSecondsShown = seconds;
    this.refreshEventText();
  }

  private createPauseControls(): void {
    const pauseButton = this.add.rectangle(640, 43, 160, 40, 0x2563eb);
    pauseButton.setInteractive({ useHandCursor: true });
    pauseButton.on('pointerdown', () => this.togglePause());
    this.add.text(640, 43, 'Пауза (P)', {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#ffffff',
    }).setOrigin(0.5);

    const shade = this.add.rectangle(480, 320, 960, 640, 0x0f172a, 0.9).setInteractive();
    const title = this.add.text(480, 240, 'ПАУЗА', {
      fontFamily: 'system-ui, sans-serif', fontSize: '48px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    const hint = this.add.text(480, 320, 'Клики, покупки и таймеры остановлены', {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#cbd5e1',
    }).setOrigin(0.5);
    const resumeButton = this.add.rectangle(480, 410, 260, 64, 0x2563eb);
    resumeButton.setInteractive({ useHandCursor: true });
    resumeButton.on('pointerdown', () => this.togglePause());
    const resumeText = this.add.text(480, 410, 'Продолжить (P)', {
      fontFamily: 'system-ui, sans-serif', fontSize: '21px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.pauseOverlay = this.add.container(0, 0, [shade, title, hint, resumeButton, resumeText])
      .setDepth(1).setVisible(false);
    this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.P)
      .on('down', () => this.togglePause());
  }

  private togglePause(): void {
    this.isPaused = !this.isPaused;
    this.time.paused = this.isPaused;
    this.tweens.paused = this.isPaused;
    this.pauseOverlay.setVisible(this.isPaused);
  }

  private addStatCard(x: number, label: string): void {
    this.add.rectangle(x + 135, 151, 270, 90, 0x1e293b).setStrokeStyle(1, 0x334155);
    this.add.text(x + 18, 119, label, {
      fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#94a3b8', fontStyle: 'bold',
    });
  }

  private nextUpgradeCost(): number {
    const phaseMultiplier = this.phase === 2 ? PHASE_TWO_UPGRADE_MULTIPLIER : 1;
    return Math.ceil(UPGRADE_COST * UPGRADE_COST_GROWTH ** this.upgrades * phaseMultiplier);
  }

  private rewardPerClick(): number {
    if (this.activeEvent === 'ipBlock') return 0;
    const normalReward = STARTING_REWARD + this.upgrades;
    if (this.activeEvent !== 'overselling') return normalReward;
    return this.upgrades === 0 ? 0 : Math.max(1, Math.floor(normalReward / 2));
  }

  private clickKoala(): void {
    if (this.isPaused) return;

    const reward = this.rewardPerClick();
    if (reward === 0) {
      const message = this.activeEvent === 'ipBlock' ? 'IP заблокирован' : 'Оверселлинг: доход 0';
      this.showClickFeedback(message, '#f87171');
      return;
    }

    this.balance += reward;
    this.earned += reward;
    this.advancePhase();
    this.showClickFeedback(`+${reward}`, '#4ade80');
    this.advanceGoal();
    this.refreshDisplay();
  }

  private showClickFeedback(message: string, color: string): void {
    const feedback = this.add.text(263, 300, message, {
      fontFamily: 'system-ui, sans-serif', fontSize: '25px', color, fontStyle: 'bold',
    }).setOrigin(0.5);
    this.tweens.add({
      targets: feedback, y: 265, alpha: 0, duration: 650,
      onComplete: () => feedback.destroy(),
    });
  }

  private buyUpgrade(): void {
    if (this.isPaused) return;

    const cost = this.nextUpgradeCost();
    if (this.balance < cost) return;

    this.balance -= cost;
    this.upgrades += 1;
    this.refreshDisplay();
  }

  private startEvent(): void {
    this.activeEvent = this.nextEvent;
    this.nextEvent = this.nextEvent === 'overselling' ? 'ipBlock' : 'overselling';
    const duration = this.activeEvent === 'overselling' ? OVERSELLING_DURATION_MS : IP_BLOCK_DURATION_MS;
    this.lastSecondsShown = Math.ceil(duration / 1000);
    this.refreshDisplay();
    this.eventTimer = this.time.delayedCall(duration, () => this.endEvent());
  }

  private endEvent(): void {
    if (!this.activeEvent) return;

    this.eventTimer?.remove(false);
    this.activeEvent = null;
    this.lastSecondsShown = -1;
    this.refreshDisplay();
    const delay = this.phase === 2 ? PHASE_TWO_BETWEEN_EVENTS_MS : BETWEEN_EVENTS_MS;
    this.eventTimer = this.time.delayedCall(delay, () => this.startEvent());
  }

  private ipChangeCost(): number {
    return Math.ceil(this.currentGoal * IP_CHANGE_COST_RATE);
  }

  private changeIp(): void {
    if (this.isPaused) return;

    const cost = this.ipChangeCost();
    if (this.activeEvent !== 'ipBlock' || this.balance < cost) return;

    this.balance -= cost;
    this.endEvent();
    this.showClickFeedback('IP сменён', '#4ade80');
  }

  private refreshEventText(): void {
    if (this.activeEvent === 'overselling') {
      const effect = this.upgrades === 0 ? 'без мощностей доход 0' : 'награда снижена';
      this.eventText.setText(`⚠ Оверселлинг: ${effect} ещё ${this.lastSecondsShown} с`);
    } else if (this.activeEvent === 'ipBlock') {
      this.eventText.setText(`⛔ IP заблокирован: доход 0 ещё ${this.lastSecondsShown} с`);
    } else {
      this.eventText.setText('✓ Сеть работает нормально. Пора набирать очки!');
    }
  }

  private refreshDisplay(): void {
    this.phaseText.setText(`ФАЗА ${this.phase}`).setColor(this.phase === 2 ? '#fbbf24' : '#93c5fd');
    this.balanceText.setText(`${this.balance} очков`);
    this.rewardText.setText(`${this.rewardPerClick()} очков`);
    this.goalText.setText(`${this.earned} / ${this.currentGoal}`);
    this.upgradeText.setText(`Куплено: ${this.upgrades}\nСледующая мощность: ${this.nextUpgradeCost()} очков`);
    this.buyButtonText.setText(`Купить за ${this.nextUpgradeCost()}`);
    this.buyButton.setFillStyle(this.balance >= this.nextUpgradeCost() ? 0x2563eb : 0x475569);
    const ipBlocked = this.activeEvent === 'ipBlock';
    const canChangeIp = ipBlocked && this.balance >= this.ipChangeCost();
    this.changeIpButton.setVisible(ipBlocked).setFillStyle(canChangeIp ? 0x2563eb : 0x475569);
    this.changeIpButtonText.setVisible(ipBlocked).setText(`Сменить IP за ${this.ipChangeCost()}`);
    if (canChangeIp) {
      this.changeIpButton.setInteractive({ useHandCursor: true });
    } else {
      this.changeIpButton.disableInteractive();
    }
    this.refreshEventText();
  }

  private advancePhase(): void {
    if (this.phase === 2 || this.earned < PHASE_TWO_START_EARNED) return;

    this.phase = 2;
    if (!this.activeEvent && this.eventTimer) {
      const delay = Math.min(this.eventTimer.getRemaining(), PHASE_TWO_BETWEEN_EVENTS_MS);
      this.eventTimer.remove(false);
      this.eventTimer = this.time.delayedCall(delay, () => this.startEvent());
    }
  }

  private advanceGoal(): void {
    if (this.earned < this.currentGoal) return;

    while (this.earned >= this.currentGoal) {
      this.currentGoal += GOAL_INCREMENT;
    }
    const feedback = this.add.text(480, 625, `Цель достигнута! Новая цель: ${this.currentGoal}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#4ade80', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.tweens.add({
      targets: feedback, alpha: 0, duration: 2000,
      onComplete: () => feedback.destroy(),
    });
  }
}
