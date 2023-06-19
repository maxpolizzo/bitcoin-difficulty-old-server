import { inviteGame } from './data/data.js'
import { claimLNURLVoucher, checkForPayment } from './helpers/utils.js'

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
      '/monopoly/api/v1/game_with_pay_link?bank_id=' + game.bankData.id,
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
    localStorage.setItem(
      'monopoly.game_' + game.bankData.id + '_' + window.user.wallets[0].id + '.' + key,
      JSON.stringify(game[key])
    )
  })
}

function redirect() {
  // Redirect to index.html
  window.location.href = "https://" + window.location.hostname + "/monopoly/?usr=" + user.id;
}

let game = inviteGame
game.player.id = window.user.id;
game.player.wallet_id = window.user.wallets[0].id
game.player.name = window.user.wallets[0].name;
game.player.wallets.push(window.user.wallets[0]);
// Get game invite data
const gameId = window.invite_vars.game_id;
const voucher = window.invite_vars.voucher;
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
// Set game bank data
game.bankData = {
  id: gameId,
}
// Fetch game data, claim LNURL voucher and redirect to index.html
const paid = JSON.parse(localStorage.getItem('monopoly.game_' + gameId + '_' + game.player.wallet_id + '.paidVoucher'));
const voucherPaymentHash = localStorage.getItem('monopoly.game_' + gameId + '_' + game.player.wallet_id + '.voucherPaymentHash');

enableMonopolyExtension(window.user.id).then(() => {
  fetchGameData(game).then(() => {
    if(!paid) {
      if(!voucherPaymentHash) {
        // Claim LNURL voucher
        claimLNURLVoucher(voucher, game.player.wallets[0]).then(() => {
          redirect()
        })
      } else {
        checkForPayment(voucherPaymentHash)
      }
    } else {
      redirect()
    }
  })
})

new Vue({
  el: '#vue',
  mixins: [windowMixin],
  data: {},
  methods: {}
})
