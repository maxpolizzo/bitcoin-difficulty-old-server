import { properties } from '../data/properties.js'
import {
  loadGameDataFromDatabase,
  getGamePlayerFromUserAndWallet
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
import { loadGameDataFromLocalStorage, storeGameRecord } from './storage.js'

export async function loadGameFromURL(gameRecords, wallets) {
  let game;
  // Load  game and player wallet from URL user and wallet ids
  if(gameRecords && gameRecords.length) {
    // Figure out which game ids and player indexes correspond to URL's user id and wallet ids
    let gamePlayer = await getGamePlayerFromUserAndWallet(window.user, window.wal)
    let gameRecordToLoad = {}
    gameRecords.forEach((gameRecord) => {
      if(gameRecord.gameId === gamePlayer.gameId && gameRecord.playerIndex === gamePlayer.playerIndex.toString()) {
        gameRecordToLoad = gameRecord
      }
    })
    // Load game from local storage if possible
    if(gameRecordToLoad.location === 'storage') {
      // Load game data from local storage if possible
      game = loadGameDataFromLocalStorage(gameRecordToLoad);
    } else {
      // Load game data from database
      game = await loadGameDataFromDatabase(
        window.user,
        window.wal
      )
      // Save game in local storage
      await storeGameRecord(game)
    }
  } else {
    console.error("No game records found")
  }
  // Show invite button if needed
  if(game.fundingStatus === 'success' && !game.started && !game.showInviteButton) {
    // Show invite button only after redirection following onGameFunded() call
    game.showInviteButton = true
  }
  // Initialize game
  game = await initGameData(game, wallets);

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
