import { properties } from '../data/properties.js'
import { createGameVouchers } from './api.js'

export async function onGameFunded (game) {
  game.showFundingDialog = false
  game.showFundingView = false
  game.fundingStatus = 'success'
  game.initialFunding = game.marketLiquidity
  game.initialPlayerBalance = 1500 // 1500 sats initiali player balance
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
    localStorage.setItem(
      'monopoly.game_' + game.marketData.id + '_' + game.player.wallets[0].id + '.showFundingDialog',
      JSON.stringify(game.showFundingDialog)
    )
    localStorage.setItem(
      'monopoly.game_' + game.marketData.id + '_' + game.player.wallets[0].id + '.showFundingView',
      JSON.stringify(game.showFundingView)
    )
    localStorage.setItem(
      'monopoly.game_' + game.marketData.id + '_' + game.player.wallets[0].id + '.fundingStatus',
      JSON.stringify(game.fundingStatus)
    )
    localStorage.setItem(
      'monopoly.game_' + game.marketData.id + '_' + game.player.wallets[0].id + '.initialFunding',
      JSON.stringify(game.initialFunding)
    )
    localStorage.setItem(
      'monopoly.game_' + game.marketData.id + '_' + game.player.wallets[0].id + '.initialPlayerBalance',
      JSON.stringify(game.initialPlayerBalance)
    )
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
      '/monopoly/api/v1/game-started?game_id=' + game.marketData.id,
      game.player.wallets[0].inkey,
    )
  if(res.data) {
    game.started = res.data[0][1]
    // Save game status in local storage
    localStorage.setItem(
      'monopoly.game_' + game.marketData.id + '_' + game.player.wallets[0].id + '.started',
      game.started.toString()
    )
    if(game.started) {
      // Clear interval
      clearInterval(game.gameStartedChecker)
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
            balance: 0
          }
        )
      }
    })
    if(playersCount !== game.playersCount) {
      game.playersCount = playersCount
      // Save game data in  local storage
      localStorage.setItem(
        'monopoly.game_' + game.marketData.id + '_' + game.player.wallets[0].id + '.playersCount',
        game.playersCount
      )
      localStorage.setItem(
        'monopoly.game_' + game.marketData.id + '_' + game.player.wallets[0].id + '.players',
        JSON.stringify(game.players)
      )
      localStorage.setItem(
        'monopoly.game_' + game.marketData.id + '_' + game.player.wallets[0].id + '.playersData',
        JSON.stringify(game.playersData)
      )
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
      localStorage.setItem(
        'monopoly.game_' + game.marketData.id + '_' + game.player.wallets[0].id + '.players',
        JSON.stringify(game.players)
      )
      localStorage.setItem(
        'monopoly.game_' + game.marketData.id + '_' + game.player.wallets[0].id + '.playersData',
        JSON.stringify(game.playersData)
      )
    }
  } else {
    LNbits.utils.notifyApiError(res.error)
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
      localStorage.setItem(
        'monopoly.game_' + game.marketData.id + '_' + game.player.wallets[0].id + '.properties',
        JSON.stringify(game.properties)
      )
      localStorage.setItem(
        'monopoly.game_' + game.marketData.id + '_' + game.player.wallets[0].id + '.propertiesCount',
        JSON.stringify(game.propertiesCount)
      )
    }
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}

