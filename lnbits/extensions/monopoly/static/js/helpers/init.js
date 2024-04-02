import {
  loadGameDataFromDatabase,
  getGamePlayerFromUserWalletIndex,
  assignWallets,
  fetchPlayers,
  fetchWalletsBalances,
  fetchProperties
} from '../server/database.js'
import {
  loadGameDataFromLocalStorage,
  storeGameRecord
} from './storage.js'

export async function loadGameFromURL(gameRecords) {

  console.log(gameRecords)

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
    let gameRecordToLoad = {}
    gameRecords.forEach((gameRecord) => {
      if(gameRecord.gameId === gamePlayer.gameId && gameRecord.playerIndex === gamePlayer.playerIndex) {
        gameRecordToLoad = gameRecord
      }
    })
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
  } else {
    console.error("No game records found")
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

  return game
}

export async function initGameData(game) {
  // Fetch game players
  game = await fetchPlayers(game)
  // Fetch game wallets balances
  game = await fetchWalletsBalances(game)
  // Fetch game started
  game
  // Fetch owned properties
  if(game.started) {
    game = fetchProperties(game)
  }

  return game;
}
