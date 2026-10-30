const SPRITE_SIZE = 48;
const DEFAULT_SCALE = 2;
// Transparent space above the cat (in sprite pixels) for hearts, bubbles and the timer.
const BUBBLE_ROOM = 20;

function windowSize(scale) {
  return { width: SPRITE_SIZE * scale, height: (SPRITE_SIZE + BUBBLE_ROOM) * scale };
}

module.exports = { SPRITE_SIZE, DEFAULT_SCALE, BUBBLE_ROOM, windowSize };
