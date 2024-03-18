import { properties } from '../data/properties.js'
import { fetchMarketLiquidity, fetchPlayerBalance } from '../calls/api.js'
import {fetchPlayers, fetchPlayerTurn, loadGameDataFromDatabase} from '../calls/database.js'
import {
  checkPlayersBalances,
  checkPlayers,
  checkPlayerTurn,
  checkPlayerBalance,
  checkProperties,
  checkMarketLiquidity,
  checkGameStarted,
  checkPaymentsToPlayer
} from '../calls/intervals.js'
import { loadGameDataFromLocalStorage, saveGameRecord } from './storage.js'
import { newGame } from '../data/data.js'
import { createPlayerPayLNURL } from './utils.js'

export async function loadGame(savedGameRecords) {
  let game;
  // Load  game and player wallet
  if(window.user.id && window.game_id) {
    if(
      savedGameRecords &&
      savedGameRecords.gameRecords &&
      savedGameRecords.gameRecords[window.user.id] &&
      savedGameRecords.gameRecords[window.user.id][window.game_id]
    ) {
      game = loadGameDataFromLocalStorage(savedGameRecords.gameRecords[window.user.id][window.game_id]);
      game = initGameData(game);
    } else {
      game = await loadGameDataFromDatabase(window.game_id, window.user.id)
      // Save game in local storage
      await saveGameRecord(game)
    }
    game = await initGameData(game);
  } else {
    game = newGame;
  }
  // If not already created, create a static LNURL pay link to be used for sending sats to player
  if(game.imported && !game.playerPayLinkCreated) {
    const playerPayLinkCreated = await createPlayerPayLNURL(game); // Is this await actually working?
    if(playerPayLinkCreated) {
      game.playerPayLinkCreated = true; // Already saved in local storage
      // No need to save payLinkId and payLink in local storage (will be fetched from database by other players)
    } else {
      LNbits.utils.notifyApiError("Error creating player pay link")
    }
  }
  // Show invite button if needed
  if(game.fundingStatus === 'success' && !game.started && !game.showInviteButton) {
    // Show invite button only after redirection following onGameFunded() call
    game.showInviteButton = true
  }

  return game
}

function initGameData(game) {
    // Initialize game properties map
    game.properties["for-sale"] = properties;
    // Start checking game funding balance
    fetchMarketLiquidity(game).then(() => {
      // If game has already been funded or imported, fetch user balance, other
      // players and start checking periodically for game being started by creator
      if(game.fundingStatus === 'success' || game.imported) {
        fetchPlayerTurn(game).then(() => {
          fetchPlayerBalance(game).then(() => {
            fetchPlayers(game).then(() => {
              checkPlayersBalances(game).then(() => {
                console.log("Periodically fetching other players balances from database...")
              })
            })
          })
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
        checkPlayerBalance(game).then(() => {
          console.log("Periodically checking player balance...")
        })
        checkProperties(game).then(() => {
          console.log("Periodically checking properties ownership...")
        })
      }
      checkMarketLiquidity(game).then(() => {
        console.log("Periodically checking game funding balance...")
      })
      if(!game.started) {
        checkGameStarted(game).then(() => {
          console.log("Periodically checking if game creator started the game...")
        })
      }
    })

    // Hack to copy command to pay invoice from local node
    // game.payInvoiceCommand = "lncli -n regtest --lnddir=\"/Users/maximesuard/Dev/Perso/Bitcoin/lnd-regtest-2\" --rpcserver=localhost:11009 payinvoice "
    /*
        // Hack to display dummy properties
        game.properties[game.player.wallets[0].id] = {};
        game.properties[game.player.wallets[0].id]["66ccff"] = properties["66ccff"]
        game.properties[game.player.wallets[0].id]["66ccff"][0].miningCapacity = 4
        game.properties[game.player.wallets[0].id]["66ccff"][0].miningIncome = 748
        game.properties[game.player.wallets[0].id]["66ccff"][0].owner = game.player.wallets[0].id
        game.properties[game.player.wallets[0].id]["66ccff"][0].position = 0
        game.properties[game.player.wallets[0].id]["66ccff"][1].miningCapacity = 0
        game.properties[game.player.wallets[0].id]["66ccff"][1].miningIncome = 6
        game.properties[game.player.wallets[0].id]["66ccff"][1].owner = game.player.wallets[0].id
        game.properties[game.player.wallets[0].id]["66ccff"][1].position = 1
        game.properties[game.player.wallets[0].id]["66ccff"][2].miningCapacity = 1
        game.properties[game.player.wallets[0].id]["66ccff"][2].miningIncome = 52
        game.properties[game.player.wallets[0].id]["66ccff"][2].owner = game.player.wallets[0].id
        game.properties[game.player.wallets[0].id]["66ccff"][2].position = 2
        game.properties[game.player.wallets[0].id]["800002"] = []
        game.properties[game.player.wallets[0].id]["800002"].push(properties["800002"][1])
        game.properties[game.player.wallets[0].id]["800002"][0].miningCapacity = 2
        game.properties[game.player.wallets[0].id]["800002"][0].miningIncome = 124
        game.properties[game.player.wallets[0].id]["800002"][0].owner = game.player.wallets[0].id
        game.properties[game.player.wallets[0].id]["800002"][0].position = 0
        game.properties[game.player.wallets[0].id]["fd8008"] = []
        game.properties[game.player.wallets[0].id]["fd8008"].push(properties["fd8008"][1])
        game.properties[game.player.wallets[0].id]["fd8008"].push(properties["fd8008"][0])
        game.properties[game.player.wallets[0].id]["fd8008"][0].miningCapacity = 0
        game.properties[game.player.wallets[0].id]["fd8008"][0].miningIncome = 0
        game.properties[game.player.wallets[0].id]["fd8008"][0].owner = null
        game.properties[game.player.wallets[0].id]["fd8008"][0].position = 0
        game.properties[game.player.wallets[0].id]["fd8008"][1].miningCapacity = 0
        game.properties[game.player.wallets[0].id]["fd8008"][1].miningIncome = 2
        game.properties[game.player.wallets[0].id]["fd8008"][1].owner = null
        game.properties[game.player.wallets[0].id]["fd8008"][1].position = 1
        game.propertiesCount[game.player.wallets[0].id] = 6;
    */
    return game;
  // }
}
