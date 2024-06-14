import { createWebsocketAuthorizationToken } from './api.js'
import { storeGameData } from '../helpers/storage.js'
import {
  freeMarketWallet,
  playerWallet
} from '../helpers/helpers.js'
import {
  playPlayerPaymentReceivedSound,
  playMarketPaymentReceivedSound,
  playPlayerJoinedSound,
  playStartGameSound,
  playNextPlayerTurnSound
} from '../helpers/audio.js'
import {repositionProperties, timeout, updateGameProperties, updatePropertiesCarouselSlide} from '../helpers/utils.js'

export async function connectWebsocket(game) {
  // Fetch authorization token from server (we do this first because it is not possible to pass authentication headers
  // when connecting websocket)
  let authToken =  await createWebsocketAuthorizationToken(game)
  // Establish websocket connection with server
  let websocket = {
    url: "wss://dev.bitcoin-difficulty.io/play/ws/",
    ws: null,
  }
  websocket.ws = new WebSocket(websocket.url + game.player.clientId + "?auth_token=" + authToken);
  websocket.ws.onerror = (err) => {
    console.error(err)
  };
  websocket.ws.onclose = async () => {
    websocket.ws = null
    console.log("Websocket connection closed")
    await connectWebsocket(game)
  };
  websocket.ws.onopen = () => {
    console.log("Websocket connection opened")
    console.log(websocket.ws)
  };

  return websocket
}

export function sendMessage(ws, msg) {
  ws.send(msg)
}

export function onMessage(event, game, wallets){
  let data = JSON.parse(event.data)
  console.log("Received message: " + event.data)
  console.log(data)
  let player_index
  switch(data.type) {
    case("new_player"):
      game.playersCount += 1;
      player_index = data.player_index
      // Update game.players
      game.players[player_index] = {
        name: data.player_name,
        player_balance: 0
      }
      // Store game.players
      storeGameData(game, 'players', game.players)
      // Update game.playersData
      game.playersData.rows.push(
        {
          index: player_index,
          name: data.player_name,
          balance: 0,
          propertiesCount: 0
        }
      )
      // Store game.playersData
      storeGameData(game, 'playersData', game.playersData)
      if(parseInt(player_index) > parseInt(game.player.index)) {
        // Play sound when a new player joins the game after current player
        // Wait 500 ms between different players to have distinct sounds
        timeout(playPlayerJoinedSound, 500).then()
      }
      if(game.freeMarketWallet && game.freeMarketWallet.index && !game.started) {
        // Disable start game button until invited player has claimed invite voucher
        game.enableStartGame = false
        game.waitingForPlayersIndexes.push(player_index)
        // Store game.enableStartGame and game.waitingForPlayersIndexes
        storeGameData(game, 'enableStartGame', game.playersData)
        storeGameData(game, 'waitingForPlayersIndexes', game.waitingForPlayersIndexes)
      }
      break;
    case("player_deactivated"):
      game.playersCount -= 1;
      player_index = data.player_index
      // Update game.players
      delete game.players[player_index]
      // Store game.players
      storeGameData(game, 'players', game.players)
      // Update game.playersData
      let updatedPlayersDataRows= []
      game.playersData.rows.forEach((row) => {
        if(row.index !== player_index) {
          updatedPlayersDataRows.push(row)
        }
      })
      game.playersData.rows = updatedPlayersDataRows
      // Store game.playersData
      storeGameData(game, 'playersData', game.playersData)
      // Enable start game button if we were waiting for deactivated player to claim invite voucher
      if(game.freeMarketWallet && game.freeMarketWallet.index && !game.started && !game.enableStartGame) {
        let waitingForPlayersIndexes = []
        game.waitingForPlayersIndexes.forEach((index) => {
          if(index !== player_index) {
            waitingForPlayersIndexes.push(index)
          }
        })
        game.waitingForPlayersIndexes = waitingForPlayersIndexes
        if(!game.waitingForPlayersIndexes.length) {
          game.enableStartGame = true
        }
        // Store game.enableStartGame and game.waitingForPlayersIndexes
        storeGameData(game, 'enableStartGame', game.playersData)
        storeGameData(game, 'waitingForPlayersIndexes', game.waitingForPlayersIndexes)
      }
      // Disable all buttons and show banner for deactivated player
      if(player_index === game.player.index) {
        game.player.active = false
        // Store game.player
        storeGameData(game, 'player', game.player)
      }
      break;
    case("new_payment"):
      player_index = data.player_index
      let balance_msat = parseInt(data.balance_msat)
      let balance = Math.round(balance_msat / 1000)
      if(player_index === '0' && game.freeMarketLiquidity !== balance) {
        if(!game.started && game.freeMarketLiquidity < balance) {
          // Play audio
          playMarketPaymentReceivedSound()
        }
        // Update free market liquidity
        game.freeMarketLiquidity = balance
        // Store free market liquidity
        storeGameData(game, 'freeMarketLiquidity', game.freeMarketLiquidity)
        // Refresh free market wallet balance in LNBits left panel for game creator
        /*
        EventHub.$emit('update-wallet-balance', [
          freeMarketWallet(game).id,
          game.freeMarketLiquidity
        ])
        */
        // Implemented the following  hack because using 'update-wallet-balance' event would reset other wallets
        // live_fsat to their fsat value which is not updated for some reason
        if(freeMarketWallet(game)) {
          wallets.forEach((wallet) => {
            if(wallet.id === freeMarketWallet(game).id) {
              wallet.fsat = game.freeMarketLiquidity
              wallet.live_fsat = game.freeMarketLiquidity
            }
          })
        }
      } else {
        if(player_index === game.player.index) {
          if(game.playerBalance < balance) {
            // Play audio
            playPlayerPaymentReceivedSound()
          }
          // Update player balance
          game.playerBalance = balance
          // Store player balance
          storeGameData(game, 'playerBalance', game.playerBalance)
          // Refresh wallet balance in LNBits left panel
          wallets.forEach((wallet) => {
            if(wallet.id === playerWallet(game).id) {
              wallet.fsat = game.playerBalance
              wallet.live_fsat = game.playerBalance
            }
          })
        }
        if(game.players[player_index] && game.players[player_index].player_balance != balance) {
          game.players[player_index].player_balance = balance
          // Store players
          storeGameData(game, 'players', game.players)
        }
        game.playersData.rows.forEach((row) => {
          if(row.index === player_index && row.balance !== balance) {
            row.balance = balance
            // Store players
            storeGameData(game, 'playersData', game.playersData)
          }
        })
        // Enable start game button after all invited players have claimed invite voucher
        if(game.freeMarketWallet && game.freeMarketWallet.index && !game.started && !game.enableStartGame) {
          let waitingForPlayersIndexes = []
          Object.keys(game.players).forEach((playerIndex) => {
            if(game.players[playerIndex].player_balance < game.initialPlayerBalance) {
              waitingForPlayersIndexes.push(playerIndex)
            }
          })
          game.waitingForPlayersIndexes = waitingForPlayersIndexes
          if(!game.waitingForPlayersIndexes.length) {
            game.enableStartGame = true
          }
          // Store game.enableStartGame and game.waitingForPlayersIndexes
          storeGameData(game, 'enableStartGame', game.playersData)
          storeGameData(game, 'waitingForPlayersIndexes', game.waitingForPlayersIndexes)
        }
      }
      break;
    case("game_started"):
      // Update game status
      game.started = true
      // Store game status
      storeGameData(game, 'started', game.started)
      // Update game playerTurn
      game.playerTurn = data.first_player_turn
      // Store game playerTurn in local storage
      storeGameData(game, 'playerTurn', game.playerTurn)
      // Play audio
      playStartGameSound()
      break;
    case("next_player_turn"):
      game.playerTurn = data.player_turn
      storeGameData(game, 'playerTurn', game.playerTurn)
      if(game.playerTurn === game.player.index) {
        game.firstLightningCardThisTurn = true
        game.firstProtocolCardThisTurn = true
        game.firstStartClaimThisTurn = true
        // Store game data
        storeGameData(game, 'firstLightningCardThisTurn', game.firstLightningCardThisTurn)
        storeGameData(game, 'firstProtocolCardThisTurn', game.firstProtocolCardThisTurn)
        storeGameData(game, 'firstStartClaimThisTurn', game.firstStartClaimThisTurn)
        // Play audio
        playNextPlayerTurnSound();
      }
      break;
    case("property_purchase"):
      let property = {
        property_id: data.property_id,
        color: data.color,
        player_index: data.player_index,
        mining_capacity: parseInt(data.mining_capacity),
        mining_income: parseInt(data.mining_income)
      }
      game = updateGameProperties(game, property)
      game = repositionProperties(game)
      if(data.player_index === game.player.index) {
        // If player just bought a property, slide properties carousel to show that property
        game.propertiesCarouselSlide = data.color
      } else {
        game = updatePropertiesCarouselSlide(game)
      }
      // Store game data
      storeGameData(game, 'properties', game.properties)
      storeGameData(game, 'propertiesCount', game.propertiesCount)
      storeGameData(game, 'propertiesCarouselSlide', game.propertiesCarouselSlide)

      break;
    case("miners_purchase"):
      // Update property's mining capacity
      game.properties[data.player_index][data.color][data.property_id].mining_capacity = parseInt(data.new_mining_capacity)
      storeGameData(game, 'properties', game.properties)
      break;
    case("mining_income"):
      // Update property's mining capacity
      game.properties[data.player_index][data.color][data.property_id].mining_income = parseInt(data.new_mining_income)
      storeGameData(game, 'properties', game.properties)
      break;
  default:
    console.error("Unknown websocket event type: " + event.type)
  }

  return game
}