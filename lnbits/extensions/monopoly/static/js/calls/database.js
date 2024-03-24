import { newGame } from '../data/data.js'
import { properties } from '../data/properties.js'
import { createGameVouchers } from './api.js'
import {playNextPlayerTurnSound, playPlayerJoinedSound, playStartGameSound} from '../helpers/audio.js'
import { saveGameData } from '../helpers/storage.js'
import { timeout } from '../helpers/utils.js'


function inkey(game) {
  let inkey
  if(game.freeMarketWallet) {
    inkey = game.freeMarketWallet.inkey
  } else if(game.player.wallet) {
    inkey = game.player.wallet.inkey
  }
  return inkey
}

export async function onGameFunded (game) {
  game.showFundingDialog = false
  game.showFundingView = false
  game.fundingStatus = 'success'
  game.initialFunding = game.freeMarketLiquidity
  game.initialPlayerBalance = 1500 // 1500 sats initial player balance
  // Register initial funding and initial player balance in database
  const res = await LNbits.api
    .request(
      'PUT',
      '/monopoly/api/v1/game/funding',
      game.freeMarketWallet.adminkey,
      {
        game_id: game.id,
        initial_funding: game.initialFunding,
        initial_player_balance: game.initialPlayerBalance
      }
    )
  if(res.status === 201) {
    // Save game data into local storage
    saveGameData(game, 'showFundingDialog', game.showFundingDialog)
    saveGameData(game, 'showFundingView', game.showFundingView)
    saveGameData(game, 'fundingStatus', game.fundingStatus)
    saveGameData(game, 'initialFunding', game.initialFunding)
    saveGameData(game, 'initialPlayerBalance', game.initialPlayerBalance)
    console.log("Monopoly: game has been funded")
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
  // Create LNURl vouchers to be claimed by players
  await createGameVouchers(game)
}

export async function fetchGameStarted(game) {
  let res = await LNbits.api
    .request(
      'GET',
      '/monopoly/api/v1/game-started?game_id=' + game.id,
      inkey(game)
    )
  if(res.data) {
    let gameStarted = res.data[0][1]
    if(gameStarted && !game.started) {
      game.gameStartedUpdated = false // This is a lock to avoid playing startGame sound multiple times if player
      // device is idle while game starts
      game.started = gameStarted
      // Save game status in local storage
      saveGameData(game, 'started', game.started)
      // Clear interval
      clearInterval(game.gameStartedChecker)
      if(game.started && !game.gameStartedUpdated) {
        console.log("GAME STARTED")
        playStartGameSound()
      }
      game.gameStartedUpdated = true
    }
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}

export async function fetchPlayers(game) {
  let res = await LNbits.api
    .request(
      'GET',
      '/monopoly/api/v1/players?game_id=' + game.id,
      inkey(game)
    )
  if(res.data) {
    let playersCount = 0
    for (const player of res.data) {
      playersCount += 1;
      if(!game.players[player.player_index]){
        game.newPlayerUpdated = false // This is a lock to avoid playing playerJoined sound multiple times if player
        // device is idle while another player joins
        game.players[player.player_index] = player
        saveGameData(game, 'players', game.players)
        game.playersData.rows.push(
          {
            name: player.player_name,
            balance: player.player_balance,
            index: player.player_index
          }
        )
        saveGameData(game, 'playersData', game.playersData)
        if(player.player_index > game.player.index && !game.newPlayerUpdated) {
          // Play sound when players join the game after current player
          await timeout(playPlayerJoinedSound, 500) // Wait 500 ms between different players to have distinct sounds
        }
        game.newPlayerUpdated = false
      }
    }
    if(playersCount !== game.playersCount) {
      game.playersCount = playersCount
      // Save game data in  local storage
      saveGameData(game, 'playersCount', game.playersCount)
    }
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}

export async function fetchPlayersBalances(game) {
  // Fetch players from database
  let res = await LNbits.api
    .request(
      'GET',
      '/monopoly/api/v1/players?game_id=' + game.id,
      inkey(game)
    )
  if(res.data) {
    let balanceChanged = false;
    res.data.forEach((player) => {
      if(game.players[player.player_index]) {
        if(game.players[player.player_index].player_balance !== player.player_balance) {
          balanceChanged = true
          game.players[player.player_index].player_balance = player.player_balance
        }
        for(let i = 0; i < game.playersData.rows.length; i++) {
          if(
            game.playersData.rows[i].name === player.player_name
            &&  game.playersData.rows[i].balance !== player.player_balance
          ) {
            balanceChanged = true
            game.playersData.rows[i].balance = player.player_balance
          }
        }
      }
    })
    if(balanceChanged) {
      // Save game data in  local storage
      saveGameData(game, 'players', game.players)
      saveGameData(game, 'playersData', game.playersData)
    }
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}

export async function fetchPlayerTurn(game) {
  // Fetch player turn from database
  let res = await LNbits.api
      .request(
        'GET',
        '/monopoly/api/v1/player_turn?game_id=' + game.id,
        inkey(game)
      )
  if(res.data) {
    let nextPlayerTurn = res.data["player_turn"]
    if(nextPlayerTurn !== game.playerTurn)  {
      game.playerTurnUpdated = false // This is a lock to avoid playing nextPlayerTurn sound multiple times if player
      // device is idle while player turn changes
      game.playerTurn = nextPlayerTurn
      saveGameData(game, 'playerTurn', game.playerTurn)
      if(game.playerTurn === game.player.index && !game.playerTurnUpdated) {
        game.firstLightningCardThisTurn = true
        game.firstProtocolCardThisTurn = true
        game.firstStartClaimThisTurn = true
        saveGameData(game, 'firstLightningCardThisTurn', game.firstLightningCardThisTurn)
        saveGameData(game, 'firstProtocolCardThisTurn', game.firstProtocolCardThisTurn)
        saveGameData(game, 'firstStartClaimThisTurn', game.firstStartClaimThisTurn)
        playNextPlayerTurnSound();
      }
      game.playerTurnUpdated = true
    }
  }
}

export async function fetchProperties(game) {
  // Updated properties
  let gameProperties = {};
  let gamePropertiesCount = {};
  let res = await LNbits.api
    .request(
      'GET',
      '/monopoly/api/v1/properties?game_id=' + game.id,
      inkey(game)
    )
  if(res.data) {
    if(res.data.length) {
      res.data.forEach((property) => {
        if(property.player_index){
          // If property is owned
          if(!gameProperties[property.player_index]) {
            gameProperties[property.player_index] = {}
            gameProperties[property.player_index][property.color] = []
          } else if(!gameProperties[property.player_index][property.color]) {
            gameProperties[property.player_index][property.color] = []
          }
          // Update property data
          // FYI: this also updates the imported properties object in data.js
          let updatedProperty = properties[property.color][property.property_id];
          updatedProperty.mining_capacity = property.mining_capacity
          updatedProperty.mining_income = property.mining_income
          updatedProperty.player_index = property.player_index
          if(game.players && game.players[property.player_index]) {
            updatedProperty.player_name = game.players[property.player_index].player_name
          }
          // Keep property card position in case it is already owned by player
          let newProperty = true;
          if(game.properties[game.player.index] &&
            game.properties[game.player.index][property.color] &&
            game.properties[game.player.index][property.color].length
          ) {
            game.properties[game.player.index][property.color].forEach((previouslyOwnedProperty) => {
              if(previouslyOwnedProperty.id === property.property_id && property.player_index === game.player.index) {
                // Property was already owned by player
                newProperty = false;
                updatedProperty.position = previouslyOwnedProperty.position;
              }
            })
          }
          // If property was not already owned by player, assign position
          if(newProperty) {
            if(!game.properties[property.player_index]) {
              updatedProperty.position = 0
            } else if(!game.properties[property.player_index][property.color]) {
              updatedProperty.position = 0
            } else {
              updatedProperty.position = game.properties[property.player_index][property.color].length
            }
          }
          // Add property to gameProperties
          gameProperties[property.player_index][property.color].push(updatedProperty)
          // Update gamePropertiesCount
          if(!gamePropertiesCount[property.player_index]) {
            gamePropertiesCount[property.player_index] = 0
          }
          gamePropertiesCount[property.player_index] += 1
          // If property was just sold, close property invoice dialog
          if(game.properties[game.player.index] &&
            game.properties[game.player.index][property.color] &&
            game.properties[game.player.index][property.color].length
          ) {
            game.properties[game.player.index][property.color].forEach((previouslyOwnedProperty) => {
              if(previouslyOwnedProperty.id === property.property_id && property.player_index !== game.player.index) {
                game.playerInvoiceAmount = null;
                game.propertySaleData = null;
                game.saleInvoiceCreated = false;
                game.showSaleInvoiceDialog = false;
                game.showPropertyInvoiceDialog = false
              }
            })
          }
        }
      })
      // Re-position player's properties in case a property was sold and a position is now empty
      if(gameProperties[game.player.index] && Object.keys(gameProperties[game.player.index]).length) {
        Object.keys(gameProperties[game.player.index]).forEach((propertyColor) => {
          for(let pos = 0; pos < gameProperties[game.player.index][propertyColor].length; pos++) {
            let foundPosition = false;
            gameProperties[game.player.index][propertyColor].forEach((property) => {
              if(property.position === pos) {
                foundPosition = true;
              }
            });
            if(!foundPosition)  {
              for(let i = 0; i < gameProperties[game.player.index][propertyColor].length; i++) {
                if(gameProperties[game.player.index][propertyColor][i].position > pos) {
                  gameProperties[game.player.index][propertyColor][i].position--
                }
              }
            }
          }
        })
      }
      // Update game.propertiesCarouselSlide in case property was sold and seller doesn't own any property of the same
      // color anymore
      if(gameProperties[game.player.index] &&
        Object.keys(gameProperties[game.player.index]) &&
        Object.keys(gameProperties[game.player.index]).length
      ) {
          if(!gameProperties[game.player.index][game.propertiesCarouselSlide] ||
            !gameProperties[game.player.index][game.propertiesCarouselSlide].length
          ) {
            game.propertiesCarouselSlide = Object.keys(gameProperties[game.player.index])[0];
          }
      } else {
        game.propertiesCarouselSlide = '';
      }
      // Update game data
      game.properties = gameProperties;
      game.propertiesCount = gamePropertiesCount;
      // Save game data in local storage
      saveGameData(game, 'properties', game.properties)
      saveGameData(game, 'propertiesCount', game.propertiesCount)
    }
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}

export async function loadGameDataFromDatabase(user, walletId) {
  console.log("Loading game data from database: " + user.id + ", " + walletId);
  // Game creator can recover game data using free market wallet adminkey
  // Other players can recover game data using player wallet adminkey
  let game = newGame;
  game.player.id = user.id
  let wallet
  user.wallets.forEach((userWallet) => {
    if(userWallet.id === walletId) {
      wallet = userWallet
    }
  })
  // Fetch player wallet from database
  let res = await LNbits.api
    .request(
      'GET',
      '/monopoly/api/v1/wallet?wallet_id=' + wallet.id,
      wallet.adminkey,
    )
  if(res.data) {
    if(res.data.is_free_market) {
      // Game creator's free market wallet
      game.freeMarketWallet = wallet
      game.created = true
      game.id = res.data.game_id
      game.freeMarketWalletPayLinkId = res.data.pay_link_id
      game.freeMarketWalletPayLink = res.data.pay_link
      // Fetch game creator's player index
      for(let index in user.wallets) {
        res = await LNbits.api
          .request(
            'GET',
            '/monopoly/api/v1/wallet-info?game_id=' + game.id + '&wallet_id=' + user.wallets[index].id,
            inkey(game),
          )
        if(res.data) {
          if(res.data.game_id === game.id && !res.data.is_free_market) {
            game.player.index = res.data.player_index
            game.player.wallet = user.wallets[index]
            break
          }
        }
      }
    } else  {
      // Player wallet
      game.imported = true
      game.id = res.data.game_id
      game.player.index = res.data.player_index
      game.player.wallet = wallet
      // Fetch free market wallet pay link from database
      res = await LNbits.api
        .request(
          'GET',
          '/monopoly/api/v1/player_pay_link?game_id=' + game.id + '&pay_link_player_index=0',
          game.player.wallet.inkey
        )
      if(res.data) {
        game.freeMarketWalletPayLink = res.data.pay_link
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
    }
  }
  // Fetch game data from database
  res = await LNbits.api
    .request(
      'GET',
      '/monopoly/api/v1/game?game_id=' + game.id,
      inkey(game)
    )
  if(res.data) {
    let gameData =  {}
    for(let index in res.data) {
      gameData[res.data[index][0]] = res.data[index][1]
    }
    game.timestamp = gameData.time
    game.started = gameData.started

    if(gameData.initial_funding) {
      // Game has been funded
      game.fundingStatus = 'success'
      game.initialFunding = gameData.initial_funding
      game.initialPlayerBalance = gameData.initial_player_balance
      game.inviteVoucherId = gameData.invite_voucher_id
      game.rewardVoucherId = gameData.reward_voucher_id
      if(game.inviteVoucherId && game.rewardVoucherId) {
        game.showInviteButton = true
      }
      // Fetch player data from database
      res = await LNbits.api
        .request(
          'GET',
          '/monopoly/api/v1/player?game_id=' + game.id + '&player_index=' + game.player.index,
          inkey(game)
        )
      if(res.data) {
        game.player.name = res.data.player_name
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
    } else {
      game.showFundingView = true
    }

    return game
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}
