import { inviteGame } from './data/data.js'
import { claimInviteVoucher, checkForPayment } from './helpers/utils.js'

let game = inviteGame
game.player.id = window.user.id;
game.player.wallet_id = window.user.wallets[0].id
game.player.name = window.user.wallets[0].name;
game.player.wallets.push(window.user.wallets[0]);
// Get game invite data
const gameId = window.invite_vars.game_id;
const inviteVoucher = window.invite_vars.invite_voucher;
game.rewardVoucher = window.invite_vars.reward_voucher.toString();

// Check local storage for existing games
let existingGameRecords = JSON.parse(localStorage.getItem('monopoly.gameRecords'))
let gameRecord
if(existingGameRecords && existingGameRecords.length) {
  for(let i = 0; i < existingGameRecords.length; i++) {
    if(existingGameRecords[i] === 'game_' + gameId + '_' + game.player.wallet_id) {
      gameRecord = existingGameRecords[i]
      break
    }
  }
}

if(gameRecord) { // If game is already registered in local storage
  // Update game object with values found in local storage
  Object.keys(game).forEach((key) => {
    try {
      game[key] = JSON.parse(localStorage.getItem('monopoly.' + gameRecord + '.' + key))
    } catch(err) {
      game[key] = localStorage.getItem('monopoly.' + gameRecord + '.' + key)
    }
  })
} else {
  // Register new game record in local storage
  if(existingGameRecords && existingGameRecords.length) {
    existingGameRecords.push('game_' + gameId + '_' + game.player.wallet_id)
  } else {
    existingGameRecords = ['game_' + gameId + '_' + game.player.wallet_id]
  }
  localStorage.setItem('monopoly.gameRecords', JSON.stringify(existingGameRecords))
}
// Set game's market data
game.marketData = {
  id: gameId,
}
// Fetch game data, claim invite voucher and redirect to index.html
const paid = JSON.parse(localStorage.getItem('monopoly.game_' + gameId + '_' + game.player.wallet_id + '.paidVoucher'));
const inviteVoucherPaymentHash = localStorage.getItem('monopoly.game_' + gameId + '_' + game.player.wallet_id + '.inviteVoucherPaymentHash');

enableMonopolyExtension(window.user.id).then(() => {
  fetchGameData(game).then(() => {
    if(!paid) {
      if(!inviteVoucherPaymentHash) {
        // Claim invite voucher
        claimInviteVoucher(inviteVoucher, game.player.wallets[0]).then(() => {
          redirect()
        })
      } else {
        checkForPayment(inviteVoucherPaymentHash)
      }
    } else {
      redirect()
    }
  })
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
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
  // Save game in local storage
  Object.keys(game).forEach((key) => {
    console.log(key)
    try {
      if(game[key].toString() !== '[object Object]') {
        localStorage.setItem(
          'monopoly.game_' + game.marketData.id + '_' + window.user.wallets[0].id + '.' + key,
          game[key].toString()
        )
      } else {
        localStorage.setItem(
          'monopoly.game_' + game.marketData.id + '_' + window.user.wallets[0].id + '.' + key,
          JSON.stringify(game[key])
        )
      }
    } catch(err) {
      localStorage.setItem(
        'monopoly.game_' + game.marketData.id + '_' + window.user.wallets[0].id + '.' + key,
        JSON.stringify(game[key])
      )
    }
  })
}

function redirect() {
  // Redirect to index.html
  window.location.href = "https://" + window.location.hostname + "/monopoly/?usr=" + user.id;
}

new Vue({
  el: '#vue',
  mixins: [windowMixin],
  data: {},
  methods: {}
})
