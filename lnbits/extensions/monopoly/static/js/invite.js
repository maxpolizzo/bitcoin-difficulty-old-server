import { inviteGame } from './data/data.js'
import {
  saveGameRecord,
  saveGameData
} from './helpers/storage.js'
import {
  checkMaxNumberOfPlayersReached,
  claimInviteVoucher
} from './helpers/utils.js'


let game = inviteGame
game.player.id = window.user.id;
game.player.wallet_id = window.user.wallets[0].id
game.player.name = window.user.wallets[0].name;
game.player.wallets.push(window.user.wallets[0]);
// Get game invite data
const gameId = window.invite_vars.game_id;
const inviteVoucher = window.invite_vars.invite_voucher;
game.rewardVoucher = window.invite_vars.reward_voucher.toString();
// Set game's market data
game.marketData = {
  id: gameId,
}

// Fetch game data, claim invite voucher and redirect to index.html
enableMonopolyExtension(window.user.id).then(async () => {
  await fetchGameData(game);
})

const claimedVoucher = JSON.parse(localStorage.getItem('monopoly.game_' + game.marketData.id + '_' + game.player.id + '_' + game.player.wallet_id + '.paidVoucher'));
const inviteVoucherPaymentHash = localStorage.getItem('monopoly.game_' + game.marketData.id + '_' + game.player.id + '_' + game.player.wallet_id + '.inviteVoucherPaymentHash');

new Vue({
  el: '#vue',
  mixins: [windowMixin],
  data: {
    game: game,
    inviteVoucher: inviteVoucher,
    inviteVoucherPaymentHash: inviteVoucherPaymentHash,
    claimedVoucher: claimedVoucher,
    maxNumberOfPlayersReached: false,
    joinedGame: false
  },
  methods: {
    joinGame: async function() {
      this.maxNumberOfPlayersReached = await checkMaxNumberOfPlayersReached(game.marketData.id)
      // Join game if current_players_count < max_players_count
      if(!this.maxNumberOfPlayersReached && !this.joinedGame) {
          this.joinedGame = true // Prevent claiming multiple times
          // Claim invite voucher
          await claimInviteVoucher(this.inviteVoucher, this.game, this.game.player.wallets[0]);
          // Join game
          await joinGame(this.game);
          // Redirect to game view
          redirect(this.game);
      }
    }
  }
})

// Logic to enable the Monopoly extension
async function enableMonopolyExtension(userId) {
  await LNbits.api
    .request(
      'GET',
      '/extensions?usr=' + userId + '&enable=monopoly',
      window.user.wallets[0].inkey
    )
}

// Logic to fetch game data and claim LNURL voucher
async function fetchGameData (game) {
  // Fetch game data from database
  let res = await LNbits.api
    .request(
      'GET',
      '/monopoly/api/v1/game_with_pay_link?game_id=' + game.marketData.id,
      window.user.wallets[0].inkey
    )
  if(res.data) {
    game.initialFunding = res.data[2][1]
    game.initialPlayerBalance = res.data[3][1]
    game.players.playersCount = res.data[4][1]
    game.lnurlPayId = res.data[5][1]
    game.lnurlPayLink = res.data[6][1]
    console.log("Successfully fetched game data from database")
    // Save game in local storage
    saveGameRecord(game)
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}
/*
function saveGameRecord(game) {
  // Check local storage for existing game records
  let existingGameRecords = JSON.parse(localStorage.getItem('monopoly.gameRecords'))
  let gameRecord
  if(existingGameRecords && existingGameRecords.length) {
    for(let i = 0; i < existingGameRecords.length; i++) {
      if(
        existingGameRecords[i].split('_')[1] === game.marketData.id &&
        existingGameRecords[i].split('_')[2] === game.player.id
      ) {
        gameRecord = existingGameRecords[i]
        break
      }
    }
  }
  // console.log(gameRecord)
  if(!gameRecord) { // If game is not already registered in local storage
    console.log("Saving game record...")
    // Register new game record in local storage
    game.timestamp = Date.now()
    if(existingGameRecords && existingGameRecords.length) {
      existingGameRecords.push('game_' + game.marketData.id + '_' + game.player.id + '_' + game.player.wallet_id + '_' + game.timestamp)
    } else {
      existingGameRecords = ['game_' + game.marketData.id + '_' + game.player.id + '_' + game.player.wallet_id + '_' + game.timestamp]
    }
    localStorage.setItem('monopoly.gameRecords', JSON.stringify(existingGameRecords))
  }
}
*/

async function joinGame(game) {
  let res = await LNbits.api
      .request(
          'POST',
          '/monopoly/api/v1/join',
          window.user.wallets[0].inkey,
          {
            game_id: game.marketData.id,
            player_user_id: game.player.id,
            player_wallet_id: game.player.wallets[0].id,
            player_wallet_name: game.player.wallets[0].name,
            player_wallet_inkey: game.player.wallets[0].inkey,
          }
      )
  if(res.data) {
    // Save player index in local storage
    game.player.index = parseInt(res.data.player_index);
    saveGameData(game, 'player', game.player)
    console.log(game.player.name +  " successfully joined the game")
    return game
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}

function redirect(game) {
  // Redirect to game.html
  window.location.href = "https://" + window.location.hostname + "/monopoly/game?usr=" + game.player.id + "&game_id=" + game.marketData.id;
}