import { newGame } from '../data/data.js'
import { properties } from '../data/properties.js'
import { createGameVouchers } from './api.js'
import {playNextPlayerTurnSound, playPlayerJoinedSound, playStartGameSound} from '../helpers/audio.js'
import { saveGameData } from '../helpers/storage.js'
import { timeout } from '../helpers/utils.js'

export async function onGameFunded (game, reload = false) {
  game.showFundingDialog = false
  game.showFundingView = false
  game.fundingStatus = 'success'
  game.initialFunding = game.marketLiquidity
  game.initialPlayerBalance = 1500 // 1500 sats initial player balance
  if(reload && game.inviteVoucherId && game.rewardVoucherId) {
    console.log("onGameFunded RELOAD")
    game.showInviteButton = true
    return game
  } else {
    console.log("onGameFunded REGULAR")
    // Register initial funding and initial player balance in database
    const res = await LNbits.api
      .request(
        'PUT',
        '/monopoly/api/v1/games/funding',
        game.player.wallets[0].inkey,
        {
          game_id: game.marketData.id,
          initial_funding: game.initialFunding,
          initial_player_balance: game.initialPlayerBalance
        }
      )
    if(res.data) {
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
    // Redirect to game.html
    window.location.href = "https://" + window.location.hostname + "/monopoly/game?usr=" + game.player.id + "&game_id=" + game.marketData.id;
  }
}

export async function fetchGameStarted(game) {
  /*
  let inkey
  if(game.player.wallets.length) {
    inkey = game.player.wallets[0].inkey // Case where player wallet has already been created
  } else {
    inkey = game.marketData.wallets[0].inkey  // Case where player wallet has not yet been created
  }
  */
  let res = await LNbits.api
    .request(
      'GET',
      '/monopoly/api/v1/game-started?game_id=' + game.marketData.id,
      // inkey,
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
      '/monopoly/api/v1/players?game_id=' + game.marketData.id,
      // game.player.wallets[0].inkey
    )
  if(res.data) {
    let playersCount = 0
    for (const player of res.data) {
      playersCount += 1;
      if(!game.players[player.player_wallet_id]){
        game.newPlayerUpdated = false // This is a lock to avoid playing playerJoined sound multiple times if player
        // device is idle while another player joins
        game.players[player.player_wallet_id] = player
        saveGameData(game, 'players', game.players)
        game.playersData.rows.push(
          {
            name: player.player_wallet_name,
            balance: 0,
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
      '/monopoly/api/v1/players?game_id=' + game.marketData.id,
      // game.player.wallets[0].inkey
    )
  if(res.data) {
    let balanceChanged = false;
    res.data.forEach((player) => {
      if(game.players[player.player_wallet_id]) {
        if(game.players[player.player_wallet_id].player_balance !== player.player_balance) {
          balanceChanged = true
          game.players[player.player_wallet_id].player_balance = player.player_balance
        }
        for(let i = 0; i < game.playersData.rows.length; i++) {
          if(
            game.playersData.rows[i].name === player.player_wallet_name
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
          '/monopoly/api/v1/player_turn?game_id=' + game.marketData.id,
          // game.player.wallets[0].inkey
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
      '/monopoly/api/v1/properties?game_id=' + game.marketData.id,
      // game.player.wallets[0].inkey
    )
  if(res.data) {
    if(res.data.length) {
      res.data.forEach((property) => {
        if(property.property_owner_id){
          // If property is owned
          if(!gameProperties[property.property_owner_id]) {
            gameProperties[property.property_owner_id] = {}
            gameProperties[property.property_owner_id][property.property_color] = []
          } else if(!gameProperties[property.property_owner_id][property.property_color]) {
            gameProperties[property.property_owner_id][property.property_color] = []
          }
          // Update property data
          let updatedProperty = properties[property.property_color][property.property_id];
          updatedProperty.mining_capacity = property.property_mining_capacity
          updatedProperty.mining_income = property.property_mining_income
          updatedProperty.owner = property.property_owner_id
          // Get property owner's name
          Object.keys(game.players).forEach((player_id) => {
            if(player_id === property.property_owner_id) {
              updatedProperty.owner_name = game.players[player_id].player_wallet_name
            }
          });
          // Keep property card position in case it is already owned by player
          let newProperty = true;
          if(game.properties[game.player.wallets[0].id] &&
            game.properties[game.player.wallets[0].id][property.property_color] &&
            game.properties[game.player.wallets[0].id][property.property_color].length
          ) {
            game.properties[game.player.wallets[0].id][property.property_color].forEach((previouslyOwnedProperty) => {
              if(previouslyOwnedProperty.id === property.property_id && property.property_owner_id === game.player.wallets[0].id) {
                // Property was already owned by player
                newProperty = false;
                updatedProperty.position = previouslyOwnedProperty.position;
              }
            })
          }
          // If property was not already owned by player, assign position
          if(newProperty) {
            if(!game.properties[property.property_owner_id]) {
              updatedProperty.position = 0
            } else if(!game.properties[property.property_owner_id][property.property_color]) {
              updatedProperty.position = 0
            } else {
              updatedProperty.position = game.properties[property.property_owner_id][property.property_color].length
            }
          }
          // Add property to gameProperties
          gameProperties[property.property_owner_id][property.property_color].push(updatedProperty)
          // Update gamePropertiesCount
          if(!gamePropertiesCount[property.property_owner_id]) {
            gamePropertiesCount[property.property_owner_id] = 0
          }
          gamePropertiesCount[property.property_owner_id] += 1
          // If property was just sold, close property invoice dialog
          if(game.properties[game.player.wallets[0].id] &&
            game.properties[game.player.wallets[0].id][property.property_color] &&
            game.properties[game.player.wallets[0].id][property.property_color].length
          ) {
            game.properties[game.player.wallets[0].id][property.property_color].forEach((previouslyOwnedProperty) => {
              if(previouslyOwnedProperty.id === property.property_id && property.property_owner_id !== game.player.wallets[0].id) {
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
      if(gameProperties[game.player.wallets[0].id] && Object.keys(gameProperties[game.player.wallets[0].id]).length) {
        Object.keys(gameProperties[game.player.wallets[0].id]).forEach((propertyColor) => {
          for(let pos = 0; pos < gameProperties[game.player.wallets[0].id][propertyColor].length; pos++) {
            let foundPosition = false;
            gameProperties[game.player.wallets[0].id][propertyColor].forEach((property) => {
              if(property.position === pos) {
                foundPosition = true;
              }
            });
            if(!foundPosition)  {
              for(let i = 0; i < gameProperties[game.player.wallets[0].id][propertyColor].length; i++) {
                if(gameProperties[game.player.wallets[0].id][propertyColor][i].position > pos) {
                  gameProperties[game.player.wallets[0].id][propertyColor][i].position--
                }
              }
            }
          }
        })
      }
      // Update game.propertiesCarouselSlide in case property was sold and seller doesn't own any property of the same
      // color anymore
      if(gameProperties[game.player.wallets[0].id] &&
        Object.keys(gameProperties[game.player.wallets[0].id]) &&
        Object.keys(gameProperties[game.player.wallets[0].id]).length
      ) {
          if(!gameProperties[game.player.wallets[0].id][game.propertiesCarouselSlide] ||
            !gameProperties[game.player.wallets[0].id][game.propertiesCarouselSlide].length
          ) {
            game.propertiesCarouselSlide = Object.keys(gameProperties[game.player.wallets[0].id])[0];
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

export async function registerPayment(game, payment) {
  // register payment in database
  let res = await LNbits.api
    .request(
      'POST',
      '/monopoly/api/v1/payments',
      "", // game.player.wallets[0].inkey,
      {
        game_id: game.marketData.id,
        player_wallet_id: payment.wallet_id,
        amount: payment.amount,
        date_time: payment.date,
        is_in: payment.isIn,
        is_out: payment.isOut,
        memo: payment.memo,
        payment_hash: payment.payment_hash,
        bolt11: payment.bolt11
      }
    )
  if(res.data) {
    console.log("Payment registered successfully")
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}

export async function loadGameDataFromDatabase(gameId, playerId) {
  console.log("Loading saved game from database..." + window.game_id);
  let game = newGame;
  game.marketData.id = gameId;
  // Fetch game data from database
  let res = await LNbits.api
    .request(
      'GET',
      '/monopoly/api/v1/games?game_id=' + game.marketData.id
    )
  if(res.data) {
    let gameData =  {}
    for(let index in res.data) {
      gameData[res.data[index][0]] = res.data[index][1]
    }
    game.timestamp = gameData.time
    if(gameData.admin_user_id === playerId) {
      // Player is game creator
      game.created = true
      game.player.id = gameData.admin_user_id
      game.playersCount = 1
      game.lnurlPayLinkId = gameData.pay_link_id
      game.lnurlPayLink = gameData.pay_link
      // Fetch free market wallet controlled by game creator
      // This is fetched separately for security reasons:
      // TO DO: request an API key so that this can only be fetched by game creator (and make sure it can't be fetched
      // by other means)
      // API key could be admin key from game creator's other wallet wallets[0] which game creator would necessarily
      // have created before creating the game
      // This API key would allow game creator to reload any game created with the used_id of this wallet (recover
      // free market wallet, player wallet and game data) and to re-generate invite links for all other players which
      // allow to recover those players' wallets as well
      res = await LNbits.api
        .request(
          'GET',
          '/monopoly/api/v1/free_market_wallet?game_id=' + gameId
        )
      if(res.data) {
        // Save free market wallet
        game.marketData.wallets.push({
          id: res.data.free_market_wallet_id,
          inkey: res.data.free_market_wallet_inkey,
          adminkey: res.data.free_market_wallet_adminkey
        })
      }
    } else {
      game.imported = true
    }
    if(gameData.initial_funding) {
      // Game has been funded
      game.initialFunding = gameData.initial_funding
      game.initialPlayerBalance = gameData.initial_player_balance
      game.inviteVoucherId = gameData.invite_voucher_id
      game.rewardVoucherId = gameData.reward_voucher_id
      game = await onGameFunded(game, true)
      // Fetch player data from database
      // TO DO: do not allow player_id and wallet_id to be fetched by anyone from database (security risk)
      // Instead, request an API key so that this can only be fetched by game creator (and make sure it can't be fetched
      // by other means)
      // In order to reload the game, players need to get a recovery link from game creator. This link contains an
      // ephemeral API key set by game creator which allows players to recover their player wallet and game data
      res = await LNbits.api
        .request(
          'GET',
          '/monopoly/api/v1/player_by_user_id?game_id=' + gameId + '&player_id=' + playerId
        )
      if(res.data) {
        console.log(res.data)
        game.player.id = res.data.player_user_id
        game.player.index = res.data.player_index
        game.player.name = res.data.player_wallet_name
        game.player.wallet_id = res.data.player_wallet_id
        game.player.wallets.push({
          id: res.data.player_wallet_id,
          name: res.data.player_wallet_name,
          user: res.data.player_user_id,
          // adminkey:
          inkey: res.data.player_wallet_inkey,
          balance_msat: res.data.player_balance * 1000
        })
        // Fetch player pay link from database
        res = await LNbits.api
          .request(
            'GET',
            '/monopoly/api/v1/players/pay_link?player_wallet_id=' + game.player.wallet_id
          )
        if(res.data) {
          if(res.data.player_pay_link_id && res.data.player_pay_link)
            game.playerPayLinkCreated = true
        }
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
    } else {
      game.showFundingView = true
    }
    if(gameData.started) {
      // Game has been started
      game.started = gameData.started
    }

    return game
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}


