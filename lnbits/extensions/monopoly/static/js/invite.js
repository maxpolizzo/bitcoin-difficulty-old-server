import { inviteGame } from './data/data.js'
import {
  saveGameRecord,
  saveGameData
} from './helpers/storage.js'
import {
  checkMaxNumberOfPlayersReached,
  claimInviteVoucher,
  createPlayerPayLNURL
} from './helpers/utils.js'
import { reactiveStyles } from '../css/styles.js'

let game = inviteGame
game.player.id = window.user.id;
game.player.wallet = window.user.wallets[0]
game.player.name = window.user.wallets[0].name;
// Get invite_vars
game.id = window.invite_vars.game_id
// Invite and reward vouchers are passed in the invite URL and cannot be obtained by other means
const inviteVoucher = window.invite_vars.invite_voucher;
game.rewardVoucher = window.invite_vars.reward_voucher.toString();
// Fetch game data, claim invite voucher and redirect to game.html
enableMonopolyExtension(window.user.id).then(async () => {
  await fetchGameData(game);
})

new Vue({
  el: '#vue',
  mixins: [windowMixin],
  data: {
    game: game,
    inviteVoucher: inviteVoucher,
    maxNumberOfPlayersReached: false,
    joiningGame: false,
    joinedGame: false
  },
  methods: {
    joinGame: async function() {
      this.joiningGame = true;
      this.maxNumberOfPlayersReached = await checkMaxNumberOfPlayersReached(game)
      // Join game if current_players_count < max_players_count
      if(!this.maxNumberOfPlayersReached && !this.joinedGame) {
        this.joinedGame = true // Prevents claiming multiple times from the same invite (still possible to claim
        // multiple times by calling invite link several times)
        // Claim invite voucher
        await claimInviteVoucher(this.inviteVoucher, this.game, this.game.player.wallet);
        // Join game
        await joinGame(this.game);
        // Redirect to game view
        redirect(this.game);
      } else {
        // Display error message
      }
    }
  },
  computed: {
    // Pass Vue components props here
    reactiveStyles: function() {
      return reactiveStyles(this.game)
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
      '/monopoly/api/v1/game_invite?game_id=' + game.id,
      window.user.wallets[0].inkey
    )
  if(res.data) {
    console.log(res.data)
    game.freeMarketLiquidity = res.data.free_market_liquidity
    game.initialFunding = res.data.initial_funding
    game.initialPlayerBalance = res.data.initial_player_balance
    game.maxPlayersCount = res.data.max_players_count
    console.log("Successfully fetched game data from database")
    game.timestamp = Date.now()
    // Save game in local storage
    saveGameRecord(game)
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}

async function joinGame(game) {
  // Register new player in database
  let res = await LNbits.api
      .request(
          'POST',
          '/monopoly/api/v1/join-game',
          window.user.wallets[0].inkey,
          {
            game_id: game.id,
            user_id: game.player.id,
            wallet_id: game.player.wallet.id,
            player_name: game.player.name
          }
      )
  if(res.data) {
    console.log(res.data)
    // Save player index in local storage
    game.player.index = parseInt(res.data.player_index);
    saveGameData(game, 'player', game.player)
    console.log(game.player.name +  " successfully joined the game")
    // Create and save player pay link
    const playerPayLinkCreated = await createPlayerPayLNURL(game);
    if(playerPayLinkCreated) {
      game.playerPayLinkCreated = true; // Already saved in local storage
    } else {
      LNbits.utils.notifyApiError("Error creating player pay link")
    }
    // Get free market wallet pay link from database
    res = await LNbits.api
      .request(
        'GET',
        '/monopoly/api/v1/player_pay_link?game_id=' + game.id + '&pay_link_player_index=0',
        game.player.wallet.inkey
      )
    if(res.data) {
      console.log("Free market wallet pay link: " + res.data.pay_link)
      game.freeMarketWalletPayLink = res.data.pay_link
      saveGameData(game, 'freeMarketWalletPayLink', game.freeMarketWalletPayLink)
    } else {
      LNbits.utils.notifyApiError(res.error)
    }
    return game
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}

function redirect(game) {
  // Redirect to game.html
  window.location.href = "https://" + window.location.hostname + "/monopoly/game?usr=" + game.player.id + "&wal=" + game.player.wallet.id;
}
