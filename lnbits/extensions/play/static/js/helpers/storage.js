import { newGame } from '../data/data.js'

export function getGameRecordsFromLocalStorage(gamePlayers, gameRecords = []) {
  // Fetch existing game records in local storage
  let storedGameRecords = JSON.parse(localStorage.getItem('play.gameRecords'))
  if(storedGameRecords && storedGameRecords.length) {
    for(let j = 0; j < storedGameRecords.length; j++) {
      const gameId = storedGameRecords[j].split('_')[0];
      const playerIndex = storedGameRecords[j].split('_')[1];
      const dateTime = new Date(parseInt(storedGameRecords[j].split('_')[2])).toString().split(' GMT')[0];
      gamePlayers.forEach((player) => {
        if(playerIndex === player.playerIndex) {
          gameRecords.push(
            {
              gameId,
              playerIndex,
              dateTime,
              location: 'storage'
            }
          )
        }
      })
    }
  }
  return gameRecords;
}

export function storeGameRecord(game) {
  // Store game record to local storage
  let storedGameRecords = JSON.parse(localStorage.getItem('play.gameRecords'))
  let gameRecordAlreadyStored = false;
  if(storedGameRecords && storedGameRecords.length) {
    storedGameRecords.forEach((gameRecordString) => {
      if(game.freeMarketWallet && game.freeMarketWallet.index) {
        // Game creator
        if(gameRecordString.startsWith(game.id + '_0')) {
          gameRecordAlreadyStored = true;
        }
      } else if(game.player && parseInt(game.player.index) > 1) {
        // Other players
        if(gameRecordString.startsWith(game.id + '_' + game.player.index)) {
          gameRecordAlreadyStored = true;
        }
      }
    })
  }
  if(!gameRecordAlreadyStored) {
    if(storedGameRecords && storedGameRecords.length) {
      if(game.freeMarketWallet && game.freeMarketWallet.index) {
        // Game creator
        storedGameRecords.push(game.id + '_0_' + game.timestamp)
      } else if(game.player && parseInt(game.player.index) > 1) {
        // Other players
        storedGameRecords.push(game.id + '_' + game.player.index + '_' + game.timestamp)
      }
    } else {
      if(game.freeMarketWallet && game.freeMarketWallet.index) {
        // Game creator
        storedGameRecords = [game.id + '_0_' + game.timestamp]
      } else if(game.player && parseInt(game.player.index) > 1) {
        // Other players
        storedGameRecords = [game.id + '_' + game.player.index + '_' + game.timestamp]
      }
    }
    localStorage.setItem('play.gameRecords', JSON.stringify(storedGameRecords))
  }
  // Store game data to local storage
  Object.keys(game).forEach((key) => {
    storeGameData(game, key, game[key])
  })
}

export function loadGameDataFromLocalStorage(gameRecord) {
  console.log("Loading saved game from local storage: " + gameRecord.gameId + " " + gameRecord.playerIndex);
  const game = newGame;
  // Update game object with values found in local storage
  Object.keys(game).forEach((key) => {
    if(localStorage.getItem('play.' + gameRecord.gameId + '_' + gameRecord.playerIndex + '.' + key) !== null) {
      try {
        game[key] = JSON.parse(localStorage.getItem('play.' + gameRecord.gameId + '_' + gameRecord.playerIndex + '.' + key))
      } catch(err) {
        game[key] = localStorage.getItem('play.' + gameRecord.gameId + '_' + gameRecord.playerIndex + '.' + key)
      }
    }
  })

  return game;
}

export function storeGameData(game, key, data) {
  // Save game data to local storage
  if(game.freeMarketWallet && game.freeMarketWallet.index) {
    // Game creator
    localStorage.setItem(
      'play.' + game.id + '_0' + '.' + key.toString(),
      JSON.stringify(data)
    )
  } else if(game.player && parseInt(game.player.index) > 1) {
    // Other players
    localStorage.setItem(
      'play.' + game.id + '_' + game.player.index + '.' + key.toString(),
      JSON.stringify(data)
    )
  }
}
