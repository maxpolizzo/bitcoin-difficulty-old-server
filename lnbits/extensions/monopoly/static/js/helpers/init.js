import { newGame } from '../data/data.js'
import { properties } from '../data/properties.js'
import { fetchBankBalance, fetchPlayerBalance } from '../calls/api.js'
import { fetchGameStarted, fetchPlayers } from '../calls/database.js'
import {
  checkPlayersBalances,
  checkPlayers,
  checkPlayerBalance,
  checkProperties,
  checkBankBalance,
  checkGameStarted
} from '../calls/intervals.js'

export function loadGameData() {
  // Logic executed when page loads
  //
  // Initialise game data with template
  let game = newGame
  // Check local storage for existing games
  let existingGameRecords = JSON.parse(localStorage.getItem('monopoly.gameRecords'))
  if(existingGameRecords && existingGameRecords.length) {
    for(let i = 0; i < window.user.wallets.length; i++) {
      let userWalletId = window.user.wallets[i].id
      let gameRecord
      for(let j = 0; j < existingGameRecords.length; j++) {
        if(existingGameRecords[j].split('_')[2] === userWalletId) {
          gameRecord = existingGameRecords[j]
          break
        }
      }
      if(gameRecord) {
        // Update game object with values found in local storage
        Object.keys(game).forEach((key) => {
          try {
            game[key] = JSON.parse(localStorage.getItem('monopoly.' + gameRecord + '.' + key))
          } catch(err) {
            game[key] = localStorage.getItem('monopoly.' + gameRecord + '.' + key)
          }
        })
        break;
      }
    }
  }
  return game;
}

export function initGameData(game) {
    // return function () {
    // Initialize game properties map
    game.properties["for-sale"] = properties;
    // Start checking bank balance
    fetchBankBalance(game).then(() => {
      // If game has already been created or imported, fetch user balance, other
      // players and start checking periodically for game being started by creator
      if(game.created || game.imported) {
        fetchPlayerBalance(game).then(() => {
          fetchPlayers(game).then(() => {
            checkPlayersBalances(game).then(() => {
              console.log("Periodically fetching other players balances from database...")
            })
          })
        })
        checkPlayers(game).then(() => {
          console.log("Periodically checking for new players...")
        })
        checkPlayerBalance(game).then(() => {
          console.log("Periodically checking player balance...")
        })
        checkProperties(game).then(() => {
          console.log("Periodically checking properties ownership...")
        })
      }
      checkBankBalance(game).then(() => {
        console.log("Periodically checking bank balance...")
      })
      if(game.created) {
        fetchGameStarted(game).then()
      } else if(game.imported) {
        checkGameStarted(game).then(() => {
          console.log("Periodically checking if game creator started the game...")
        })
      }
    })

    // Hack to copy command to pay invoice from local node
    game.payInvoiceCommand = "lncli -n regtest --lnddir=\"/Users/maximesuard/Dev/Perso/Bitcoin/lnd-regtest-2\" --rpcserver=localhost:11009 payinvoice "
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
