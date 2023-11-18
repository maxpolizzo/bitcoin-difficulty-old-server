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
  let currentPlayerTurn = game.playerTurn;
  // Fetch player turn from database
  let res = await LNbits.api
      .request(
          'GET',
          '/monopoly/api/v1/player_turn?game_id=' + game.marketData.id,
          game.player.wallets[0].inkey
      )
  if(res.data) {
    game.playerTurn = res.data["player_turn"]
    saveGameData(game, 'playerTurn', game.playerTurn)
    if(game.playerTurn !== currentPlayerTurn && game.playerTurn === game.player.index) {
      game.firstLightningCardThisTurn = true
      game.firstProtocolCardThisTurn = true
      game.firstStartClaimThisTurn = true
      saveGameData(game, 'firstLightningCardThisTurn', game.firstLightningCardThisTurn)
      saveGameData(game, 'firstProtocolCardThisTurn', game.firstProtocolCardThisTurn)
      saveGameData(game, 'firstStartClaimThisTurn', game.firstStartClaimThisTurn)
      playNextPlayerTurnSound();
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
          let _property = properties[property.property_color][property.property_id];
          _property.mining_capacity = property.property_mining_capacity
          _property.mining_income = property.property_mining_income
          _property.owner = property.property_owner_id
          // Get property owner's name
          Object.keys(game.players).forEach((player_id) => {
            if(player_id === property.property_owner_id) {
              _property.owner_name = game.players[player_id].player_wallet_name
            }
          });
          // Keep property card position in case it is already owned by player
          if(_property.owner === game.player.wallets[0].id) {
            let newProperty = true;
            if(
              game.properties[property.property_owner_id]
              && game.properties[property.property_owner_id][property.property_color]
            ) {
              game.properties[property.property_owner_id][property.property_color].forEach((__property) => {
                if(__property.id === _property.id) {
                  newProperty = false;
                  if(__property.position >= 0) {
                    _property.position = __property.position
                  } else {
                    _property.position = gameProperties[property.property_owner_id][property.property_color].length
                  }
                }
              })
            }
            if(newProperty) {
              _property.position = gameProperties[property.property_owner_id][property.property_color].length
            }
          }
          // Add property to properties owned by property_owner_id
          gameProperties[property.property_owner_id][property.property_color].push(_property)
          // Update properties count for property_owner_id
          if(!gamePropertiesCount[property.property_owner_id]) {
            gamePropertiesCount[property.property_owner_id] = 0
          }
          gamePropertiesCount[property.property_owner_id] += 1
        }
      })
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

