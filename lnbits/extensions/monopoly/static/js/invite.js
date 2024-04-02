import { inviteGame } from './data/data.js'
import {
  storeGameRecord,
  storeGameData
} from './helpers/storage.js'
import {
  checkMaxNumberOfPlayersReached,
  claimInviteVoucher,
  createPlayerPayLNURL
} from './helpers/utils.js'
import {
  playerWallet,
  inkey
} from './helpers/helpers.js'
import { reactiveStyles } from '../css/styles.js'
import {
  fetchGameInviteData,
  getFreeMarketWalletPayLink,
  joinGame
} from './server/database.js'

new Vue({
  el: '#vue',
  mixins: [windowMixin],
  data: function() {
    return {
      websocket: {
        url: "wss://dev.bitcoin-difficulty.io/monopoly/ws/",
        ws: null
      },
      game: inviteGame,
      inviteVoucher: null,
      maxNumberOfPlayersReached: false,
      joiningGame: false,
      joinedGame: false
    }
  },
  mounted(){
    this.initializeGameData().then(async () => {
      this.enableMonopolyExtension()
    })
  },
  methods: {
    initializeGameData: async function() {
      // Initialize game data
      this.game.player.wallet = { index: 0 }
      this.game.player.name = playerWallet(this.game).name;
      // Get invite_vars
      this.game.id = window.invite_vars.game_id
      this.game.player.clientId = window.invite_vars.client_id
      // Invite and reward vouchers are passed in the invite URL and cannot be obtained by other means
      this.inviteVoucher = window.invite_vars.invite_voucher;
      this.game.rewardVoucher = window.invite_vars.reward_voucher.toString();
      // Fetch additional game data
      let gameInviteData = await fetchGameInviteData({
        id: this.game.id,
        player: { wallet: this.game.player.wallet }
      })
      this.game = {
        ...this.game,
        ...gameInviteData
      }
    },
    // Logic to enable the Monopoly extension
    enableMonopolyExtension: async function()  {
      await LNbits.api
        .request(
          'GET',
          '/extensions?usr=' + window.user.id + '&enable=monopoly',
          inkey(this.game)
        )
    },
    joinGame: async function() {
      this.joiningGame = true;
      this.maxNumberOfPlayersReached = await checkMaxNumberOfPlayersReached(this.game)
      // Join game if current_players_count < max_players_count
      if(!this.maxNumberOfPlayersReached && !this.joinedGame) {
        this.joinedGame = true // Prevents claiming multiple times from the same invite (still possible to claim
        // multiple times by calling invite link several times)
        // Join game


        console.log(this.game)

        let playerIndex = await joinGame({
          id: this.game.id,
          player: { name: this.game.player.name, clientId: this.game.player.clientId, wallet: this.game.player.wallet }
        })
        this.game.player = {
          ...this.game.player,
          index: playerIndex
        }
        // Register player's lnurl pay link
        await createPlayerPayLNURL(this.game);
        let payLink = await getFreeMarketWalletPayLink({
          id: this.game.id,
          player: { wallet: this.game.player.wallet }
        })
        this.game = {
          ...this.game,
          freeMarketWalletPayLink: payLink
        }
        // Store game record in local storage
        storeGameRecord(this.game)
        // Claim invite voucher
        await claimInviteVoucher(this.inviteVoucher, this.game);
        // Redirect to game view
        this.redirect();
      } else {
        // Display error message
      }
    },
    redirect: function() {
      // Redirect to game.html
      window.location.href = "https://" + window.location.hostname + "/monopoly/game?usr=" + window.user.id + "&wal=" + playerWallet(this.game).id;
    }
  },
  computed: {
    // Pass Vue components props here
    reactiveStyles: function() {
      return reactiveStyles(this.game)
    }
  }
})
