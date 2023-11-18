import {gameRecordsData, newGame} from '../data/data.js'

export function fetchGameRecords() {
  // Fetch existing game records in local storage
  const gameRecords = {};
  let existingGameRecords = JSON.parse(localStorage.getItem('monopoly.gameRecords'))
  if(existingGameRecords && existingGameRecords.length) {
    for(let j = 0; j < existingGameRecords.length; j++) {
      const userId = existingGameRecords[j].split('_')[1];
      const gameId = existingGameRecords[j].split('_')[2];
      if(!gameRecords[userId]) {
        gameRecords[userId] = {};
      }
      gameRecords[userId][gameId] = existingGameRecords[j].split('_')[0] + '_' + existingGameRecords[j].split('_')[1] + '_' + existingGameRecords[j].split('_')[2];
      const dateTime = new Date(parseInt(existingGameRecords[j].split('_')[3])).toString().split('GMT')[0];
      // Saved games for user
      if(userId == window.user.id) {
        gameRecordsData.rows.push(
          {
            userId,
            gameId,
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
  if(existingGameRecords && existingGameRecords.length) {
    existingGameRecords.push('game_' + game.player.id + '_' + game.marketData.id + '_' + game.timestamp)
  } else {
    existingGameRecords = ['game_' + game.player.id + '_' + game.marketData.id + '_' + game.timestamp]
  }
  localStorage.setItem('monopoly.gameRecords', JSON.stringify(existingGameRecords))
  // Save game to local storage
  Object.keys(game).forEach((key) => {
    saveGameData(game, key, game[key])
  })
}

export function loadGameData(gameRecord) {
  console.log(gameRecord)
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
  localStorage.setItem(
    'monopoly.game_' + game.player.id + '_' + game.marketData.id + '.' + key.toString(),
    JSON.stringify(data)
  )
}
