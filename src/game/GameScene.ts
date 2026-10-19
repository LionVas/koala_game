import Phaser from 'phaser';
import koalaUrl from '../../Koala.png?url';
import { BALANCE, COLORS, TIMING, UI, VIEWPORT } from './gameConfig';

type EventType = 'overselling' | 'ipBlock';

export class GameScene extends Phaser.Scene {
  private balance = 0;
  private earned = 0;
  private upgrades = 0;
  private currentGoal = BALANCE.initialGoal;
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
    this.currentGoal = BALANCE.initialGoal;
    this.phase = 1;
    this.activeEvent = null;
    this.nextEvent = 'overselling';
    this.isPaused = false;
    this.time.paused = false;
    this.tweens.paused = false;
    this.eventTimer = null;
    this.lastSecondsShown = -1;

    this.add.text(UI.title.x, UI.title.y, 'КОАЛА-ХОСТИНГ', {
      fontFamily: 'system-ui, sans-serif', fontSize: UI.fontSizes.title, color: COLORS.heading, fontStyle: 'bold',
    });
    this.add.text(UI.subtitle.x, UI.subtitle.y, 'Кликай по коале и покупай мощности.', {
      fontFamily: 'system-ui, sans-serif', fontSize: UI.fontSizes.subtitle, color: COLORS.muted,
    });
    this.add.rectangle(UI.phaseBadge.x, UI.phaseBadge.y, UI.phaseBadge.width, UI.phaseBadge.height, COLORS.panel)
      .setStrokeStyle(UI.borderWidth, COLORS.border);
    this.phaseText = this.add.text(UI.phaseBadge.x, UI.phaseBadge.y, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: UI.fontSizes.phase, color: COLORS.phaseOne, fontStyle: 'bold',
    }).setOrigin(UI.centerOrigin);
    this.add.text(UI.phaseHint.x, UI.phaseHint.y, `От ${BALANCE.phaseTwoStartEarned} очков начинается вторая фаза: цены ×${BALANCE.phaseTwoUpgradeMultiplier}, помехи чаще`, {
      fontFamily: 'system-ui, sans-serif', fontSize: UI.fontSizes.caption, color: COLORS.muted,
    });

    const restartButton = this.add.rectangle(UI.restartButton.x, UI.restartButton.y, UI.restartButton.width, UI.restartButton.height, COLORS.disabledButton);
    restartButton.setInteractive({ useHandCursor: true });
    restartButton.on('pointerdown', () => this.scene.restart());
    this.add.text(UI.restartButton.x, UI.restartButton.y, 'Начать заново', {
      fontFamily: 'system-ui, sans-serif', fontSize: UI.fontSizes.button, color: COLORS.white,
    }).setOrigin(UI.centerOrigin);

    const valueStyle = {
      fontFamily: 'system-ui, sans-serif', fontSize: UI.fontSizes.statValue, color: COLORS.white, fontStyle: 'bold',
    };
    this.addStatCard(UI.stats.balanceX, 'БАЛАНС');
    this.addStatCard(UI.stats.rewardX, 'ЗА КЛИК');
    this.addStatCard(UI.stats.goalX, 'ЦЕЛЬ');
    this.balanceText = this.add.text(UI.stats.balanceX + UI.stats.valueOffsetX, UI.stats.valueY, '', valueStyle);
    this.rewardText = this.add.text(UI.stats.rewardX + UI.stats.valueOffsetX, UI.stats.valueY, '', valueStyle);
    this.goalText = this.add.text(UI.stats.goalX + UI.stats.valueOffsetX, UI.stats.valueY, '', valueStyle);

    this.add.rectangle(UI.eventBanner.x, UI.eventBanner.y, UI.eventBanner.width, UI.eventBanner.height, COLORS.panel)
      .setStrokeStyle(UI.borderWidth, COLORS.border);
    this.eventText = this.add.text(UI.eventText.x, UI.eventText.y, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: UI.fontSizes.event, color: COLORS.text,
    });
    this.changeIpButton = this.add.rectangle(UI.changeIpButton.x, UI.changeIpButton.y, UI.changeIpButton.width, UI.changeIpButton.height, COLORS.button);
    this.changeIpButton.on('pointerdown', () => this.changeIp());
    this.changeIpButtonText = this.add.text(UI.changeIpButton.x, UI.changeIpButton.y, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: UI.fontSizes.ipButton, color: COLORS.white, fontStyle: 'bold',
    }).setOrigin(UI.centerOrigin);

    const koala = this.add.image(UI.koala.x, UI.koala.y, 'koala').setDisplaySize(UI.koala.width, UI.koala.height);
    koala.setInteractive({ useHandCursor: true });
    koala.on('pointerdown', () => this.clickKoala());
    this.add.text(UI.koala.x, UI.koala.hintY, 'Нажми на коалу', {
      fontFamily: 'system-ui, sans-serif', fontSize: UI.fontSizes.koalaHint, color: COLORS.text,
    }).setOrigin(UI.centerOrigin);

    this.add.rectangle(UI.shop.x, UI.shop.y, UI.shop.width, UI.shop.height, COLORS.panel)
      .setStrokeStyle(UI.borderWidth, COLORS.border);
    this.add.text(UI.shop.contentX, UI.shop.titleY, 'ВЫЧИСЛИТЕЛЬНАЯ МОЩНОСТЬ', {
      fontFamily: 'system-ui, sans-serif', fontSize: UI.fontSizes.shopTitle, color: COLORS.heading, fontStyle: 'bold',
    });
    this.add.text(UI.shop.contentX, UI.shop.hintY, `Каждая покупка даёт +${BALANCE.rewardPerUpgrade} очко за клик.`, {
      fontFamily: 'system-ui, sans-serif', fontSize: UI.fontSizes.shopHint, color: COLORS.text,
    });
    this.upgradeText = this.add.text(UI.shop.contentX, UI.shop.upgradeY, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: UI.fontSizes.upgrade, color: COLORS.upgradeText,
    });
    this.buyButton = this.add.rectangle(UI.buyButton.x, UI.buyButton.y, UI.buyButton.width, UI.buyButton.height, COLORS.button);
    this.buyButton.setInteractive({ useHandCursor: true });
    this.buyButton.on('pointerdown', () => this.buyUpgrade());
    this.buyButtonText = this.add.text(UI.buyButton.x, UI.buyButton.y, '', {
      fontFamily: 'system-ui, sans-serif', fontSize: UI.fontSizes.buyButton, color: COLORS.white, fontStyle: 'bold',
    }).setOrigin(UI.centerOrigin);

    this.createPauseControls();
    this.refreshDisplay();
    this.eventTimer = this.time.delayedCall(TIMING.firstEventDelayMs, () => this.startEvent());
  }

  update(): void {
    if (this.isPaused || !this.activeEvent || !this.eventTimer) return;

    const seconds = Math.max(0, Math.ceil(this.eventTimer.getRemaining() / TIMING.millisecondsPerSecond));
    if (seconds === this.lastSecondsShown) return;
    this.lastSecondsShown = seconds;
    this.refreshEventText();
  }

  private createPauseControls(): void {
    const pauseButton = this.add.rectangle(UI.pauseButton.x, UI.pauseButton.y, UI.pauseButton.width, UI.pauseButton.height, COLORS.button);
    pauseButton.setInteractive({ useHandCursor: true });
    pauseButton.on('pointerdown', () => this.togglePause());
    this.add.text(UI.pauseButton.x, UI.pauseButton.y, 'Пауза (P)', {
      fontFamily: 'system-ui, sans-serif', fontSize: UI.fontSizes.button, color: COLORS.white,
    }).setOrigin(UI.centerOrigin);

    const centerX = VIEWPORT.width * UI.centerOrigin;
    const centerY = VIEWPORT.height * UI.centerOrigin;
    const shade = this.add.rectangle(centerX, centerY, VIEWPORT.width, VIEWPORT.height, COLORS.overlay, UI.pause.overlayAlpha).setInteractive();
    const title = this.add.text(centerX, UI.pause.titleY, 'ПАУЗА', {
      fontFamily: 'system-ui, sans-serif', fontSize: UI.fontSizes.pauseTitle, color: COLORS.white, fontStyle: 'bold',
    }).setOrigin(UI.centerOrigin);
    const hint = this.add.text(centerX, UI.pause.hintY, 'Клики, покупки и таймеры остановлены', {
      fontFamily: 'system-ui, sans-serif', fontSize: UI.fontSizes.pauseHint, color: COLORS.text,
    }).setOrigin(UI.centerOrigin);
    const resumeButton = this.add.rectangle(centerX, UI.pause.resumeY, UI.pause.resumeButtonWidth, UI.pause.resumeButtonHeight, COLORS.button);
    resumeButton.setInteractive({ useHandCursor: true });
    resumeButton.on('pointerdown', () => this.togglePause());
    const resumeText = this.add.text(centerX, UI.pause.resumeY, 'Продолжить (P)', {
      fontFamily: 'system-ui, sans-serif', fontSize: UI.fontSizes.resumeButton, color: COLORS.white, fontStyle: 'bold',
    }).setOrigin(UI.centerOrigin);
    this.pauseOverlay = this.add.container(0, 0, [shade, title, hint, resumeButton, resumeText])
      .setDepth(UI.pause.overlayDepth).setVisible(false);
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
    this.add.rectangle(x + UI.stats.width * UI.centerOrigin, UI.stats.y, UI.stats.width, UI.stats.height, COLORS.panel)
      .setStrokeStyle(UI.borderWidth, COLORS.border);
    this.add.text(x + UI.stats.labelOffsetX, UI.stats.labelY, label, {
      fontFamily: 'system-ui, sans-serif', fontSize: UI.fontSizes.caption, color: COLORS.muted, fontStyle: 'bold',
    });
  }

  private nextUpgradeCost(): number {
    const phaseMultiplier = this.phase === 2 ? BALANCE.phaseTwoUpgradeMultiplier : 1;
    return Math.ceil(BALANCE.upgradeCost * BALANCE.upgradeCostGrowth ** this.upgrades * phaseMultiplier);
  }

  private rewardPerClick(): number {
    if (this.activeEvent === 'ipBlock') return 0;
    const normalReward = BALANCE.startingReward + this.upgrades * BALANCE.rewardPerUpgrade;
    if (this.activeEvent !== 'overselling') return normalReward;
    return this.upgrades === 0 ? 0 : Math.max(BALANCE.oversellingMinimumReward, Math.floor(normalReward / BALANCE.oversellingRewardDivisor));
  }

  private clickKoala(): void {
    if (this.isPaused) return;

    const reward = this.rewardPerClick();
    if (reward === 0) {
      const message = this.activeEvent === 'ipBlock' ? 'IP заблокирован' : 'Оверселлинг: доход 0';
      this.showClickFeedback(message, COLORS.negative);
      return;
    }

    this.balance += reward;
    this.earned += reward;
    this.advancePhase();
    this.showClickFeedback(`+${reward}`, COLORS.positive);
    this.advanceGoal();
    this.refreshDisplay();
  }

  private showClickFeedback(message: string, color: string): void {
    const feedback = this.add.text(UI.clickFeedback.x, UI.clickFeedback.y, message, {
      fontFamily: 'system-ui, sans-serif', fontSize: UI.fontSizes.clickFeedback, color, fontStyle: 'bold',
    }).setOrigin(UI.centerOrigin);
    this.tweens.add({
      targets: feedback, y: UI.clickFeedback.endY, alpha: UI.clickFeedback.endAlpha, duration: TIMING.clickFeedbackDurationMs,
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
    const duration = this.activeEvent === 'overselling' ? TIMING.oversellingDurationMs : TIMING.ipBlockDurationMs;
    this.lastSecondsShown = Math.ceil(duration / TIMING.millisecondsPerSecond);
    this.refreshDisplay();
    this.eventTimer = this.time.delayedCall(duration, () => this.endEvent());
  }

  private endEvent(): void {
    if (!this.activeEvent) return;

    this.eventTimer?.remove(false);
    this.activeEvent = null;
    this.lastSecondsShown = -1;
    this.refreshDisplay();
    const delay = this.phase === 2 ? TIMING.phaseTwoBetweenEventsMs : TIMING.betweenEventsMs;
    this.eventTimer = this.time.delayedCall(delay, () => this.startEvent());
  }

  private ipChangeCost(): number {
    return Math.ceil(this.currentGoal * BALANCE.ipChangeCostRate);
  }

  private changeIp(): void {
    if (this.isPaused) return;

    const cost = this.ipChangeCost();
    if (this.activeEvent !== 'ipBlock' || this.balance < cost) return;

    this.balance -= cost;
    this.endEvent();
    this.showClickFeedback('IP сменён', COLORS.positive);
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
    this.phaseText.setText(`ФАЗА ${this.phase}`).setColor(this.phase === 2 ? COLORS.phaseTwo : COLORS.phaseOne);
    this.balanceText.setText(`${this.balance} очков`);
    this.rewardText.setText(`${this.rewardPerClick()} очков`);
    this.goalText.setText(`${this.earned} / ${this.currentGoal}`);
    this.upgradeText.setText(`Куплено: ${this.upgrades}\nСледующая мощность: ${this.nextUpgradeCost()} очков`);
    this.buyButtonText.setText(`Купить за ${this.nextUpgradeCost()}`);
    this.buyButton.setFillStyle(this.balance >= this.nextUpgradeCost() ? COLORS.button : COLORS.disabledButton);
    const ipBlocked = this.activeEvent === 'ipBlock';
    const canChangeIp = ipBlocked && this.balance >= this.ipChangeCost();
    this.changeIpButton.setVisible(ipBlocked).setFillStyle(canChangeIp ? COLORS.button : COLORS.disabledButton);
    this.changeIpButtonText.setVisible(ipBlocked).setText(`Сменить IP за ${this.ipChangeCost()}`);
    if (canChangeIp) {
      this.changeIpButton.setInteractive({ useHandCursor: true });
    } else {
      this.changeIpButton.disableInteractive();
    }
    this.refreshEventText();
  }

  private advancePhase(): void {
    if (this.phase === 2 || this.earned < BALANCE.phaseTwoStartEarned) return;

    this.phase = 2;
    if (!this.activeEvent && this.eventTimer) {
      const delay = Math.min(this.eventTimer.getRemaining(), TIMING.phaseTwoBetweenEventsMs);
      this.eventTimer.remove(false);
      this.eventTimer = this.time.delayedCall(delay, () => this.startEvent());
    }
  }

  private advanceGoal(): void {
    if (this.earned < this.currentGoal) return;

    while (this.earned >= this.currentGoal) {
      this.currentGoal += BALANCE.goalIncrement;
    }
    const feedback = this.add.text(UI.goalFeedback.x, UI.goalFeedback.y, `Цель достигнута! Новая цель: ${this.currentGoal}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: UI.fontSizes.goalFeedback, color: COLORS.positive, fontStyle: 'bold',
    }).setOrigin(UI.centerOrigin);
    this.tweens.add({
      targets: feedback, alpha: UI.goalFeedback.endAlpha, duration: TIMING.goalFeedbackDurationMs,
      onComplete: () => feedback.destroy(),
    });
  }
}
