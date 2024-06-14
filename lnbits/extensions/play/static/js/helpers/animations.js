import { playCardSound } from './audio.js'

// Draggable cards options
export function dragOptions() {
  return {
    animation: 0,
    group: "{ name: 'cards', pull: 'false', put: true }",
    disabled: false,
    ghostClass: "ghost"
  };
}

export function onMove({ relatedContext, draggedContext }) {
  const relatedElement = relatedContext.element;
  const draggedElement = draggedContext.element;
  // Only enable dragging on same color stack
  const doDrag = (
    draggedElement && draggedElement.color
    && relatedElement && relatedElement.color
    && (draggedElement.color === relatedElement.color)
    && (draggedElement.id !== relatedElement.id)
  ) === true;
  return doDrag;
}

export function onDragged(game, dragStartTime, { oldIndex, newIndex }, color) {
  // oldIndex is the id of the card that was moved, newIndex is the id of the card on which it was moved
  // Update cards positions in the stack
  let draggedElement; // Card that was dragged
  let oldPosition;
  let newPosition;
  game.properties[game.player.wallets[0].id][color].forEach((card) => {
    if(card.id === oldIndex) {
      draggedElement = card;
      oldPosition = card.position;
    }
    if(card.id === newIndex) {
      newPosition = card.position;
    }
  })
  // Dragged card position becomes the position of the moved card
  for(let i = 0; i < game.properties[game.player.wallets[0].id][color].length; i++) {
    if(game.properties[game.player.wallets[0].id][color][i].id === draggedElement.id) {
      game.properties[game.player.wallets[0].id][color][i].position = newPosition;
    }
  }
  // Other cards positions are moved by 1 up or down
  if(newPosition > oldPosition) {
    // Cards between oldPosition and (inclusive) newPosition have their position reduced by one
    for(let i = 0; i < game.properties[game.player.wallets[0].id][color].length; i++) {
      if(
        game.properties[game.player.wallets[0].id][color][i].position <= newPosition
        && game.properties[game.player.wallets[0].id][color][i].position > oldPosition
        && game.properties[game.player.wallets[0].id][color][i].id !== draggedElement.id
      ) {
        game.properties[game.player.wallets[0].id][color][i].position -= 1;
      }
    }
  } else if(newPosition < oldPosition) {
    // Cards between newPosition and oldPosition have their position increased by
    // one, including related element
    for(let i = 0; i < game.properties[game.player.wallets[0].id][color].length; i++) {
      if(
        game.properties[game.player.wallets[0].id][color][i].position >= newPosition
        && game.properties[game.player.wallets[0].id][color][i].position < oldPosition
        && game.properties[game.player.wallets[0].id][color][i].id !== draggedElement.id
      ) {
        game.properties[game.player.wallets[0].id][color][i].position += 1;
      }
    }
  }
  if(newIndex !== oldIndex) {
    // Play sound
    playCardSound();
  } else if (Date.now() - dragStartTime < 100) {
    // If property position was not changed and drag time is below 150ms,
    // treat event as if it was a click on the property card (otherwise
    // mobile taps are seen as drags)
    game.showPropertyDialog = true;
    game.propertyToShow = draggedElement;
  }
  return game
}

export function onUpdatePropertiesCarouselSlide(game, newSlide, oldSlide) {
  if(newSlide === undefined) {
    if(oldSlide === Object.keys(game.properties[game.player.wallets[0].id])[0]) {
      return Object.keys(game.properties[game.player.wallets[0].id])[Object.keys(game.properties[game.player.wallets[0].id]).length - 1]
    } else if(oldSlide === Object.keys(game.properties[game.player.wallets[0].id])[Object.keys(game.properties[game.player.wallets[0].id]).length - 1]) {
      return Object.keys(game.properties[game.player.wallets[0].id])[0]
    } else {
      return oldSlide
    }
  } else  {
    return newSlide
  }
}
