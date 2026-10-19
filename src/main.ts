import './style.css';
import { createGame } from './game/config';
import { COLORS, UI, VIEWPORT } from './game/gameConfig';

const pageStyles = {
  '--game-width': `${VIEWPORT.width}px`,
  '--game-height': `${VIEWPORT.height}px`,
  '--game-min-height': `${UI.page.minGameHeight}px`,
  '--page-padding': `${UI.page.padding}px`,
  '--game-border-radius': `${UI.page.borderRadius}px`,
  '--game-shadow': UI.page.shadow,
  '--page-text-color': COLORS.heading,
  '--page-background': COLORS.pageBackground,
};

for (const [property, value] of Object.entries(pageStyles)) {
  document.documentElement.style.setProperty(property, value);
}

createGame('game');
