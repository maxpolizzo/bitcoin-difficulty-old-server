import {
  loadGameDataFromDatabase,
  getGamePlayerFromUserWalletIndex,
  getGamePlayer,
  assignWallets,
  fetchPlayers,
  fetchWalletsBalances,
  fetchGameStarted,
  fetchPlayerTurn,
  fetchProperties
} from '../server/database.js'
import {
  loadGameDataFromLocalStorage, storeGameData,
  storeGameRecord
} from './storage.js'
import { newGame } from '../data/data.js'

export async function loadGameFromURL(gameRecords) {
  let game;
  // Load  game and player wallet from URL user and wallet ids
  if(gameRecords && gameRecords.length) {
    // Figure out which game ids and player indexes correspond to URL's user id and wallet ids
    let walletIndex
    for(let index = 0; index < window.user.wallets.length; index++) {
      if(window.user.wallets[index].id === window.wal) {
        walletIndex = index
      }
    }
    let gamePlayer = await getGamePlayerFromUserWalletIndex(walletIndex)
    // Select game record to load
    let gameRecordToLoad = {}
    gameRecords.forEach((gameRecord) => {
      if(gameRecord.gameId === gamePlayer.gameId && gameRecord.playerIndex === gamePlayer.playerIndex) {
        gameRecordToLoad = gameRecord
      }
    })
    // If player is not game creator, check if player is active in selected game
    let activePlayer = true
    let player
    if(gameRecordToLoad.playerIndex > 1) {
      player = await getGamePlayer(gameRecordToLoad)
      activePlayer = player.active
    }
    if(activePlayer) {
      // Load game from local storage if possible
      if(gameRecordToLoad.location === 'storage') {
        // Load game data from local storage if possible
        game = loadGameDataFromLocalStorage(gameRecordToLoad);
        // Re-assign wallets in case wallets indexing has changed in window.user.wallets
        game = await assignWallets(game)
      } else {
        // Load game data from database
        game = await loadGameDataFromDatabase()
      }
      // Show invite button if needed
      if(game.fundingStatus === 'success' && !game.started && !game.showInviteButton) {
        // Show invite button only after redirection following onGameFunded() call
        game.showInviteButton = true
      }
      // Initialize game
      game = await initGameData(game);
      // Store game in local storage
      await storeGameRecord(game)
    } else {
      if(gameRecordToLoad.location === 'storage') {
        // Load game data from local storage if possible
        game = loadGameDataFromLocalStorage(gameRecordToLoad);
        // Re-assign wallets in case wallets indexing has changed in window.user.wallets
        game = await assignWallets(game)
      } else {
        game = newGame
      }
      // Register game player
      game.player.name = player.player_name
      game.player.index = player.player_index
      game.player.active = false
      // Store game in local storage
      await storeGameRecord(game)
    }
  } else {
    console.error("No game records found")
  }

  return game
}

export async function initGameData(game) {
  // Fetch game players
  game = await fetchPlayers(game)
  // Fetch game wallets balances
  game = await fetchWalletsBalances(game)
  // Fetch game started
  game = await fetchGameStarted(game)
  // Fetch owned properties and player turn
  if(game.started) {
    game = await fetchPlayerTurn(game)
    game = await fetchProperties(game)
  }

  return game;
}
