import { properties } from '../data/properties.js'
import {
  loadGameDataFromDatabase
} from '../calls/database.js'
import {
  checkPlayersBalances,
  checkPlayers,
  checkPlayerTurn,
  checkProperties,
  checkGameStarted,
  checkPaymentsToPlayer,
  checkWalletsBalances
} from '../calls/intervals.js'
import { loadGameDataFromLocalStorage, saveGameRecord } from './storage.js'
import { newGame } from '../data/data.js'

export async function loadGame(savedGameRecords, wallets) {
  let game;
  // Load  game and player wallet
  if(window.user.id && window.wal) {
    if(
      savedGameRecords &&
      savedGameRecords.gameRecords &&
      savedGameRecords.gameRecords[window.user.id] &&
      savedGameRecords.gameRecords[window.user.id][window.wal]
    ) {
      game = loadGameDataFromLocalStorage(savedGameRecords.gameRecords[window.user.id][window.wal]);
    } else {
      // Recover game data from database:
      game = await loadGameDataFromDatabase(
        window.user,
        window.wal
      )
      // Save game in local storage
      await saveGameRecord(game)
    }
    game = await initGameData(game, wallets);
  } else {
    game = newGame;
  }
  // Show invite button if needed
  if(game.fundingStatus === 'success' && !game.started && !game.showInviteButton) {
    // Show invite button only after redirection following onGameFunded() call
    game.showInviteButton = true
  }
  return game
}

export function initGameData(game, wallets) {
  // Initialize game properties map
  game.properties["for-sale"] = properties;
  // Start checking game funding balance
  checkWalletsBalances(game, wallets).then(() => {
    console.log("Periodically checking free market liquidity...")
    // If game has already been funded or imported, fetch user balance, other
    // players and start checking periodically for game being started by creator
    if(game.fundingStatus === 'success' || game.imported) {
      if(!game.started) {
        checkGameStarted(game).then(() => {
          console.log("Periodically checking if game creator started the game...")
        })
      }
      checkPlayersBalances(game).then(() => {
        console.log("Periodically fetching other players balances from database...")
      })
      checkPlayers(game).then(() => {
        console.log("Periodically checking for new players...")
      })
      checkPlayerTurn(game).then(() => {
        console.log("Periodically checking current player turn...")
      })
      checkPaymentsToPlayer(game).then(() => {
        console.log("Periodically checking for payments to player wallet...")
      })
      checkProperties(game).then(() => {
        console.log("Periodically checking properties ownership...")
      })
    }
  })

  return game;
}
