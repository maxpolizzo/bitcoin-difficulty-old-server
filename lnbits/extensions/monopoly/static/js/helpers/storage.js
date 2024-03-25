import { newGame } from '../data/data.js'

export function getGameRecordsFromLocalStorage(gameRecords = []) {
  // Fetch existing game records in local storage
  let existingGameRecords = JSON.parse(localStorage.getItem('monopoly.gameRecords'))
  if(existingGameRecords && existingGameRecords.length) {
    for(let j = 0; j < existingGameRecords.length; j++) {
      const gameId = existingGameRecords[j].split('_')[0];
      const playerIndex = existingGameRecords[j].split('_')[1];
      const dateTime = new Date(parseInt(existingGameRecords[j].split('_')[2])).toString().split(' GMT')[0];
      gameRecords.push(
        {
          gameId,
          playerIndex,
          dateTime,
          location: 'storage'
        }
      )
    }
  }
  return gameRecords;
}

export function storeGameRecord(game) {
  // Save game record to local storage
  let existingGameRecords = JSON.parse(localStorage.getItem('monopoly.gameRecords'))
  let gameAlreadySaved = false;
  if(existingGameRecords && existingGameRecords.length) {
    existingGameRecords.forEach((gameRecordString) => {
      if(game.freeMarketWallet && game.freeMarketWallet.id) {
        // Game creator
        if(gameRecordString.startsWith(game.id + '_0')) {
          gameAlreadySaved = true;
        }
      } else if(game.player.wallet && game.player.wallet.id && game.player.index) {
        // Other players
        if(gameRecordString.startsWith(game.id + '_' + game.player.index)) {
          gameAlreadySaved = true;
        }
      }
    })
  }
  if(!gameAlreadySaved) {
    if(existingGameRecords && existingGameRecords.length) {
      if(game.freeMarketWallet && game.freeMarketWallet.id) {
        // Game creator
        existingGameRecords.push(game.id + '_0_' + game.timestamp)
      } else if(game.player.wallet && game.player.wallet.id && game.player.index) {
        // Other players
        existingGameRecords.push(game.id + '_' + game.player.index + '_' + game.timestamp)
      }
    } else {
      if(game.freeMarketWallet && game.freeMarketWallet.id) {
        // Game creator
        existingGameRecords = [game.id + '_0_' + game.timestamp]
      } else if(game.player.wallet && game.player.wallet.id && game.player.index) {
        // Other players
        existingGameRecords = [game.id + '_' + game.player.index + '_' + game.timestamp]
      }
    }
    localStorage.setItem('monopoly.gameRecords', JSON.stringify(existingGameRecords))
    // Save game to local storage
    Object.keys(game).forEach((key) => {
      storeGameData(game, key, game[key])
    })
  }
}

export function loadGameDataFromLocalStorage(gameRecord) {
  console.log("Loading saved game from local storage: " + gameRecord.gameId + " " + gameRecord.playerIndex);
  const game = newGame;
  // Update game object with values found in local storage
  Object.keys(game).forEach((key) => {
    if(localStorage.getItem('monopoly.' + gameRecord.gameId + '_' + gameRecord.playerIndex + '.' + key) !== null) {
      try {
        game[key] = JSON.parse(localStorage.getItem('monopoly.' + gameRecord.gameId + '_' + gameRecord.playerIndex + '.' + key))
      } catch(err) {
        game[key] = localStorage.getItem('monopoly.' + gameRecord.gameId + '_' + gameRecord.playerIndex + '.' + key)
      }
    }
  })

  return game;
}

export function storeGameData(game, key, data) {
  // Save game data to local storage
  if(game.freeMarketWallet && game.freeMarketWallet.id) {
    // Game creator
    localStorage.setItem(
      'monopoly.' + game.id + '_0' + '.' + key.toString(),
      JSON.stringify(data)
    )
  } else if(game.player.wallet && game.player.wallet.id && game.player.index) {
    // Other players
    localStorage.setItem(
      'monopoly.' + game.id + '_' + game.player.index + '.' + key.toString(),
      JSON.stringify(data)
    )
  }
}
