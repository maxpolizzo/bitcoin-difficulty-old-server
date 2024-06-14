import { newGame } from '../data/data.js'
import { properties } from '../data/properties.js'
import { createGameVouchers } from './api.js'
import {playNextPlayerTurnSound, playPlayerJoinedSound, playStartGameSound} from '../helpers/audio.js'
import { storeGameData } from '../helpers/storage.js'
import {
  updateGameProperties,
  repositionProperties,
  updatePropertiesCarouselSlide
} from '../helpers/utils.js'
import {freeMarketWallet, inkey, playerWallet} from '../helpers/helpers.js'

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
      '/play/api/v1/game/funding',
      freeMarketWallet(game).adminkey,
      {
        game_id: game.id,
        initial_funding: game.initialFunding,
        initial_player_balance: game.initialPlayerBalance
      }
    )
  if(res.status === 201) {
    // Save game data into local storage
    storeGameData(game, 'showFundingDialog', game.showFundingDialog)
    storeGameData(game, 'showFundingView', game.showFundingView)
    storeGameData(game, 'fundingStatus', game.fundingStatus)
    storeGameData(game, 'initialFunding', game.initialFunding)
    storeGameData(game, 'initialPlayerBalance', game.initialPlayerBalance)
    console.log("Bitcoin Difficulty: game has been funded")
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
  // Create LNURl vouchers to be claimed by players
  await createGameVouchers(game)
}

export async function fetchGameInviteData(gameData) {
  // Fetch game data from database
  let gameInviteData = {}
  let res = await LNbits.api
    .request(
      'GET',
      '/play/api/v1/game_invite?game_id=' + gameData.id,
      inkey(gameData)
    )
  if(res.data) {
    gameInviteData.freeMarketLiquidity = res.data.free_market_liquidity
    gameInviteData.initialFunding = res.data.initial_funding
    gameInviteData.initialPlayerBalance = res.data.initial_player_balance
    gameInviteData.maxPlayersCount = res.data.max_players_count
    console.log("Successfully fetched game data from database")
    gameInviteData.timestamp = Date.now()
  } else {
    LNbits.utils.notifyApiError(res.error)
  }

  return gameInviteData
}

export async function joinGame(gameData) {

  console.log(gameData)

  // Register new player in database
  let res = await LNbits.api
    .request(
      'POST',
      '/play/api/v1/join-game',
      inkey(gameData),
      {
        game_id: gameData.id,
        client_id: gameData.player.clientId,
        user_id: window.user.id,
        wallet_id: playerWallet(gameData).id,
        player_name: gameData.player.name
      }
    )
  if(res.data) {
    console.log(res.data)
    console.log(gameData.player.name +  " successfully joined the game")
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
  return res.data.player_index
}

export async function fetchPlayers(game) {
  let res = await LNbits.api
    .request(
      'GET',
      '/play/api/v1/players?game_id=' + game.id,
      inkey(game)
    )
  if(res.data) {
    game.playersCount = 0
    for (const player of res.data) {
      game.playersCount += 1;
      if(!game.players[player.player_index]) {
        game.players[player.player_index] = {
          name: player.player_name,
          index: player.player_index,
        }
        storeGameData(game, 'players', game.players)

        game.playersData.rows.push(
          {
            index: player.player_index,
            name: player.player_name,
            balance: 0,
            propertiesCount: 0
          }
        )
        storeGameData(game, 'playersData', game.playersData)
      }
    }
    // Save game playersCount in  local storage
    storeGameData(game, 'playersCount', game.playersCount)
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
  return game
}

export async function fetchWalletsBalances(game) {
  // Fetch game wallets from database
  let res = await LNbits.api
    .request(
      'GET',
      '/play/api/v1/wallets-info?game_id=' + game.id,
      inkey(game)
    )
  if(res.data) {
    res.data.forEach((wallet) => {
      if(wallet.player_index === '0') {
        game.freeMarketLiquidity = wallet.balance_msat ? Math.round(wallet.balance_msat / 1000) : 0
      } else {
        if(wallet.player_index === game.player.index) {
          game.playerBalance = Math.round(wallet.balance_msat / 1000)
        }
        if(game.players[wallet.player_index]) {
          game.players[wallet.player_index].player_balance = Math.round(wallet.balance_msat / 1000)
        }
        game.playersData.rows.forEach((row) => {
          if(row.index === wallet.player_index) {
            row.balance = Math.round(wallet.balance_msat / 1000)
          }
        })
      }
    })
    // Save game data in  local storage
    storeGameData(game, 'freeMarketLiquidity', game.freeMarketLiquidity)
    storeGameData(game, 'players', game.players)
  } else {
    LNbits.utils.notifyApiError(res.error)
  }

  return game
}

export async function getFreeMarketWalletPayLink(gameData){
  // Get free market wallet pay link from database
  let res = await LNbits.api
    .request(
      'GET',
      '/play/api/v1/player_pay_link?game_id=' + gameData.id + '&pay_link_player_index=0',
      inkey(gameData)
    )
  if(res.data) {
    console.log("Free market wallet pay link: " + res.data.pay_link)
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
  return res.data.pay_link
}


export async function fetchGameStarted(game) {
  let res = await LNbits.api
    .request(
      'GET',
      '/play/api/v1/game-started?game_id=' + game.id,
      inkey(game)
    )
  if(res.data) {
    let gameStarted = res.data[0][1]
    if(gameStarted !== game.started) {
      // device is idle while game starts
      game.started = gameStarted
      // Save game status in local storage
      storeGameData(game, 'started', game.started)
      if(game.started) {
        console.log("GAME STARTED")
        playStartGameSound()
      }
    }
  } else {
    LNbits.utils.notifyApiError(res.error)
  }

  return game
}

export async function fetchPlayerTurn(game) {
  // Fetch player turn from database
  let res = await LNbits.api
      .request(
        'GET',
        '/play/api/v1/player_turn?game_id=' + game.id,
        inkey(game)
      )
  if(res.data) {
    let playerTurn = res.data["player_turn"]
    if(playerTurn !== game.playerTurn)  {
      game.playerTurn = playerTurn
      storeGameData(game, 'playerTurn', game.playerTurn)
      if(game.playerTurn === game.player.index) {
        game.firstLightningCardThisTurn = true
        game.firstProtocolCardThisTurn = true
        game.firstStartClaimThisTurn = true
        storeGameData(game, 'firstLightningCardThisTurn', game.firstLightningCardThisTurn)
        storeGameData(game, 'firstProtocolCardThisTurn', game.firstProtocolCardThisTurn)
        storeGameData(game, 'firstStartClaimThisTurn', game.firstStartClaimThisTurn)
        playNextPlayerTurnSound();
      }
    }
  } else if(res.error) {
    LNbits.utils.notifyApiError(res.error)
  }

  return game
}

export async function fetchProperties(game) {
  let res = await LNbits.api
    .request(
      'GET',
      '/play/api/v1/properties?game_id=' + game.id,
      inkey(game)
    )
  console.log(res)
  if(res.data && res.data.length) {
    res.data.forEach((property) => {
      game = updateGameProperties(game, property)
    })
    game = repositionProperties(game)
    if(game.properties[game.player.index] &&
      Object.keys(game.properties[game.player.index]) &&
      Object.keys(game.properties[game.player.index]).length
    ) {
      game.propertiesCarouselSlide = Object.keys(game.properties[game.player.index])[0]
    }
    // Save game data in local storage
    storeGameData(game, 'properties', game.properties)
    storeGameData(game, 'propertiesCount', game.propertiesCount)
    storeGameData(game, 'propertiesCarouselSlide', game.propertiesCarouselSlide)
  } else if(res.error) {
    LNbits.utils.notifyApiError(res.error)
  }

  return game
}

export async function getGamePlayersFromUser(){
  let gamePlayers = []
  for(let index in window.user.wallets) {
    let res = await LNbits.api
      .request(
        'GET',
        '/play/api/v1/wallet?wallet_id=' + window.user.wallets[index].id,
        window.user.wallets[index].adminkey,
      )
    if(res.data) {
      gamePlayers.push({
          gameId: res.data.game_id,
          playerIndex: res.data.player_index,
          walletIndex: index,
        }
      )
    }
  }
  return gamePlayers
}

export async function getGamePlayerFromUserWalletIndex(walletIndex){
  let gamePlayer
  let res = await LNbits.api
    .request(
      'GET',
      '/play/api/v1/wallet?wallet_id=' + window.user.wallets[walletIndex].id,
      window.user.wallets[walletIndex].adminkey,
    )
  if(res.data) {
    gamePlayer = {
      gameId: res.data.game_id,
      playerIndex: res.data.player_index,
    }
  }
  return gamePlayer
}

export async function getGamePlayerFromGameRecord(gameRecord) {
  let gamePlayer
  // Figure out which user wallet is the player wallet for considered game record
  for(let walletIndex in window.user.wallets) {
    let candidateGamePlayer = await getGamePlayerFromUserWalletIndex(walletIndex)
    if(
      candidateGamePlayer &&
      candidateGamePlayer.gameId === gameRecord.gameId &&
      candidateGamePlayer.playerIndex === gameRecord.playerIndex
    ) {
      gamePlayer = {
        ...candidateGamePlayer,
        walletId: window.user.wallets[walletIndex].id
      }
    }
  }

  return gamePlayer
}

export async function getGamePlayer(gameRecord){
  let res = await LNbits.api
    .request(
      'GET',
      '/play/api/v1/player?game_id=' + gameRecord.gameId + '&player_index=' + gameRecord.playerIndex
    )
  if(res.data) {
    return res.data
  }
}

export async function getGameRecordsFromDatabase(gamePlayers){
  let gameRecords = []
  // Fetch saved games from database
  for(let index in gamePlayers) {
    if(gamePlayers[index].playerIndex !== "1") { // Do not use first player game record, instead use free market wallet's one
      // Fetch game time
      let res = await LNbits.api
        .request(
          'GET',
          '/play/api/v1/game-time?game_id=' + gamePlayers[index].gameId,
          window.user.wallets[gamePlayers[index].walletIndex].inkey,
        )
      if(res.data) {
        gameRecords.push(
          {
            gameId: gamePlayers[index].gameId,
            playerIndex: gamePlayers[index].playerIndex,
            dateTime: new Date(parseInt(res.data.time + '000', 10)).toString().split(' GMT')[0],
            location: 'database'
          }
        )
      }
    }
  }
  return gameRecords
}

export async function loadGameDataFromDatabase() {
  console.log("Loading game data from database: " + window.user.id + ", " + window.wal);
  let game = newGame;
  let walletIndex
  for(let index = 0; index < user.wallets.length; index++) {
    if(user.wallets[index].id === window.wal) {
      walletIndex = index
    }
  }
  // Fetch wallet from database
  let res = await LNbits.api
    .request(
      'GET',
      '/play/api/v1/wallet?wallet_id=' + user.wallets[walletIndex].id,
      user.wallets[walletIndex].adminkey,
    )
  if(res.data) {
    if(res.data.is_free_market) {
      // Game creator's free market wallet
      game.player.clientId = res.data.client_id
      game.freeMarketWallet = { index: walletIndex }
      game.created = true
      game.id = res.data.game_id
      game.freeMarketWalletPayLinkId = res.data.pay_link_id
      game.freeMarketWalletPayLink = res.data.pay_link
      // Fetch game creator's player index
      for(let index in user.wallets) {
        res = await LNbits.api
          .request(
            'GET',
            '/play/api/v1/wallet-info?game_id=' + game.id + '&wallet_id=' + user.wallets[index].id,
            inkey(game),
          )
        if(res.data) {
          if(res.data.game_id === game.id && !res.data.is_free_market) {
            game.player.index = res.data.player_index
            game.player.wallet = { index: index }
            break
          }
        }
      }
    } else  {
      // Player wallet
      game.imported = true
      game.id = res.data.game_id
      game.player.clientId = res.data.client_id
      game.player.index = res.data.player_index
      game.player.wallet = { index: walletIndex }
      // Fetch free market wallet pay link from database
      res = await LNbits.api
        .request(
          'GET',
          '/play/api/v1/player_pay_link?game_id=' + game.id + '&pay_link_player_index=0',
          inkey(game),
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
      '/play/api/v1/game?game_id=' + game.id,
      inkey(game)
    )
  if(res.data) {
    game.timestamp = res.data.time + '000'
    game.started = res.data.started
    game.playerTurn = res.data.player_turn


    if(res.data.initial_funding) {
      // Game has been funded
      game.fundingStatus = 'success'
      game.initialFunding = res.data.initial_funding
      game.initialPlayerBalance = res.data.initial_player_balance
      if(game.inviteVoucherId) {
        game.showInviteButton = true
      }
      // Fetch player data from database
      res = await LNbits.api
        .request(
          'GET',
          '/play/api/v1/player?game_id=' + game.id + '&player_index=' + game.player.index,
          // inkey(game)
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

export async function assignWallets(game) {
  // Assign wallets
  if(game.freeMarketWallet && game.freeMarketWallet.index) {
    // Assign free market wallet
    for(let index = 0; index < window.user.wallets.length; index++) {
      if(window.user.wallets[index] === window.wal) {
        game.freeMarketWallet.index = index
      }
    }
    // Assign player wallet
    for(let index in user.wallets) {
      if(index !== game.freeMarketWallet.index) {
        let res = await LNbits.api
          .request(
            'GET',
            '/play/api/v1/wallet-info?game_id=' + game.id + '&wallet_id=' + user.wallets[index].id,
            freeMarketWallet(game).inkey,
          )
        if(res.data) {
          if(res.data.game_id === game.id && !res.data.is_free_market) {
            game.player.wallet.index = index
            break
          }
        }
      }

    }
  } else if(game.player.wallet && game.player.wallet.index) {
    // Assign player wallet
    for(let index = 0; index < window.user.wallets.length; index++) {
      if(window.user.wallets[index] === window.wal) {
        game.player.wallet.index = index
      }
    }
  }

  return game
}
