import {gameRecordsData, newGame} from '../data/data.js'

export function fetchGameRecords() {
  // Fetch existing game records in local storage
  const gameRecords = {};
  let existingGameRecords = JSON.parse(localStorage.getItem('monopoly.gameRecords'))
  if(existingGameRecords && existingGameRecords.length) {
    for(let j = 0; j < existingGameRecords.length; j++) {
      const userId = existingGameRecords[j].split('_')[1];
      const walletId = existingGameRecords[j].split('_')[2];
      if(!gameRecords[userId]) {
        gameRecords[userId] = {};
      }
      gameRecords[userId][walletId] = existingGameRecords[j].split('_')[0] + '_' + existingGameRecords[j].split('_')[1] + '_' + existingGameRecords[j].split('_')[2];
      const dateTime = new Date(parseInt(existingGameRecords[j].split('_')[3])).toString().split('GMT')[0];
      // Saved games for user
      if(userId === window.user.id) {
        gameRecordsData.rows.push(
          {
            userId,
            walletId,
            dateTime
          }
        )
      }
    }
  }
  return {gameRecords, gameRecordsData};
}

export function saveGameRecord(game) {
  // Save game record to local storage
  let existingGameRecords = JSON.parse(localStorage.getItem('monopoly.gameRecords'))
  let gameAlreadySaved = false;
  if(existingGameRecords && existingGameRecords.length) {
    existingGameRecords.forEach((gameRecordString) => {
      if(game.freeMarketWallet && game.freeMarketWallet.id) {
        // Game creator
        if(gameRecordString.startsWith('game_' + game.player.id + '_' + game.freeMarketWallet.id)) {
          gameAlreadySaved = true;
        }
      } else if(game.player.wallet && game.player.wallet.id) {
        // Other players
        if(gameRecordString.startsWith('game_' + game.player.id + '_' + game.player.wallet.id)) {
          gameAlreadySaved = true;
        }
      }
    })
  }
  if(!gameAlreadySaved) {
    if(existingGameRecords && existingGameRecords.length) {
      if(game.freeMarketWallet && game.freeMarketWallet.id) {
        // Game creator
        existingGameRecords.push('game_' + game.player.id + '_' + game.freeMarketWallet.id + '_' + game.timestamp)
      } else if(game.player.wallet && game.player.wallet.id) {
        // Other players
        existingGameRecords.push('game_' + game.player.id + '_' + game.player.wallet.id + '_' + game.timestamp)
      }
    } else {
      if(game.freeMarketWallet && game.freeMarketWallet.id) {
        // Game creator
        existingGameRecords = ['game_' + game.player.id + '_' + game.freeMarketWallet.id + '_' + game.timestamp]
      } else if(game.player.wallet && game.player.wallet.id) {
        // Other players
        existingGameRecords = ['game_' + game.player.id + '_' + game.player.wallet.id + '_' + game.timestamp]
      }
    }
    localStorage.setItem('monopoly.gameRecords', JSON.stringify(existingGameRecords))
    // Save game to local storage
    Object.keys(game).forEach((key) => {
      saveGameData(game, key, game[key])
    })
  }
}

export function loadGameDataFromLocalStorage(gameRecord) {
  console.log("Loading saved game from local storage: " + window.user.id + " " + window.wal);
  const game = newGame;
  // Update game object with values found in local storage
  Object.keys(game).forEach((key) => {
    if(localStorage.getItem('monopoly.' + gameRecord + '.' + key) !== null) {
      try {
        game[key] = JSON.parse(localStorage.getItem('monopoly.' + gameRecord + '.' + key))
      } catch(err) {
        game[key] = localStorage.getItem('monopoly.' + gameRecord + '.' + key)
      }
    }
  })

  return game;
}

export function saveGameData(game, key, data) {
  // Save game data to local storage
  if(game.freeMarketWallet && game.freeMarketWallet.id) {
    // Game creator
    localStorage.setItem(
      'monopoly.game_' + game.player.id + '_' + game.freeMarketWallet.id + '.' + key.toString(),
      JSON.stringify(data)
    )
  } else if(game.player.wallet && game.player.wallet.id) {
    // Other players
    localStorage.setItem(
      'monopoly.game_' + game.player.id + '_' + game.player.wallet.id + '.' + key.toString(),
      JSON.stringify(data)
    )
  }
}
