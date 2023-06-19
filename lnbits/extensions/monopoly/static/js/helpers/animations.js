import {playCardSound} from './audio.js'

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
  console.log(game)

  // Update cards positions in the stack
  let draggedProperty;
  let draggedElement;
  game.properties[game.player.wallets[0].id][color].forEach((card) => {
    if(card.position === oldIndex) {
      draggedElement = card;
    }
  })
  // Dragged element position becomes newIndex
  for(let i = 0; i < game.properties[game.player.wallets[0].id][color].length; i++) {
    if(game.properties[game.player.wallets[0].id][color][i].id === draggedElement.id) {
      game.properties[game.player.wallets[0].id][color][i].position = newIndex;
      draggedProperty = game.properties[game.player.wallets[0].id][color][i];
    }
  }
  // Other cards positions are moved by 1 up or down
  if(newIndex > oldIndex) {
    // Cards between oldIndex and newIndex have their position reduced by
    // one, including related element
    for(let i = 0; i < game.properties[game.player.wallets[0].id][color].length; i++) {
      if(
        game.properties[game.player.wallets[0].id][color][i].position <= newIndex
        && game.properties[game.player.wallets[0].id][color][i].position > oldIndex
        && game.properties[game.player.wallets[0].id][color][i].id !== draggedElement.id
      ) {
        game.properties[game.player.wallets[0].id][color][i].position -= 1;
      }
    }
  } else {
    // Cards between newIndex and oldIndex have their position increased by
    // one, including related element
    for(let i = 0; i < game.properties[game.player.wallets[0].id][color].length; i++) {
      if(
        game.properties[game.player.wallets[0].id][color][i].position >= newIndex
        && game.properties[game.player.wallets[0].id][color][i].position < oldIndex
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
    game.propertyToShow = draggedProperty;
  }
  return game
}
