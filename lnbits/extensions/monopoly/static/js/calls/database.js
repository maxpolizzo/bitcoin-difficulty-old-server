import { properties } from '../data/properties.js'
import { createGameVouchers } from './api.js'
import { playNextPlayerTurnSound, playStartGameSound } from '../helpers/audio.js'
import { saveGameData } from '../helpers/storage.js'

export async function onGameFunded (game) {
  game.showFundingDialog = false
  game.showFundingView = false
  game.fundingStatus = 'success'
  game.initialFunding = game.marketLiquidity
  game.initialPlayerBalance = 1500 // 1500 sats initial player balance
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

export async function fetchGameStarted(game) {
  let gameWasAlreadyStarted = game.started
  let inkey
  if(game.player.wallets.length) {
    inkey = game.player.wallets[0].inkey // Case where player wallet has already been created
  } else {
    inkey = game.marketData.wallets[0].inkey  // Case where player wallet has not yet been created
  }
  let res = await LNbits.api
    .request(
      'GET',
      '/monopoly/api/v1/game-started?game_id=' + game.marketData.id,
      inkey,
    )
  if(res.data) {
    game.started = res.data[0][1]
    // Save game status in local storage
    saveGameData(game, 'started', game.started)
    if(game.started) {
      // Clear interval
      clearInterval(game.gameStartedChecker)
      if(!gameWasAlreadyStarted)  {
        playStartGameSound()
      }
      console.log("GAME STARTED")
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
      game.player.wallets[0].inkey
    )
  if(res.data) {
    let playersCount = 0
    res.data.forEach((player) => {
      playersCount += 1;
      if(!game.players[player.player_wallet_id]){
        game.players[player.player_wallet_id] = player
        game.playersData.rows.push(
          {
            name: player.player_wallet_name,
            balance: 0,
            index: player.player_index
          }
        )
      }
    })
    if(playersCount !== game.playersCount) {
      game.playersCount = playersCount
      // Save game data in  local storage
      saveGameData(game, 'playersCount', game.playersCount)
      saveGameData(game, 'players', game.players)
      saveGameData(game, 'playersData', game.playersData)
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
      game.player.wallets[0].inkey
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
          game.player.wallets[0].inkey
      )
  if(res.data) {
    let nextPlayerTurn = res.data["player_turn"]
    if(nextPlayerTurn !== game.playerTurn)  {
      game.playerTurnUpdated = false
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
      game.player.wallets[0].inkey
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
