import { properties } from './data/properties.js'
import {
  lightning_cards,
  protocol_cards
} from './data/cards.js'
import {
  newGame,
  playerNames
} from './data/data.js'
import { reactiveStyles } from '../css/styles.js'
import {
  decodeInvoice,
  withdrawFromLNURL,
  createPlayerPayLNURL
} from './helpers/utils.js'
import {
  onGameFunded,
  fetchPlayers,
  fetchPlayerTurn
} from './calls/database.js'
import {
  initGameData
} from './helpers/init.js'
import {
  fetchGameRecords,
  saveGameRecord,
  loadGameData,
  saveGameData
} from './helpers/storage.js'
import {
  fetchPlayerBalance,
  deleteInviteVoucher
} from './calls/api.js'
import {
  dragOptions,
  onMove,
  onDragged,
  onUpdateCarouselSlide
} from './helpers/animations.js'
import {
  playPlayerJoinedSound
} from './helpers/audio.js'
import {
  checkPlayerBalance,
  checkMarketLiquidity,
  checkPlayers,
  checkPlayerTurn,
  checkPlayersBalances,
  checkFundingInvoicePaid,
  checkPaymentsToFreeMarket,
  checkPaymentsToPlayer,
  checkPlayerInvoicePaid,
  checkFreeMarketInvoicePaid
} from './calls/intervals.js'
import { decodeLNURL } from './helpers/utils.js'

Vue.component(VueQrcode.name, VueQrcode)
Vue.use(VueQrcodeReader)

const savedGameRecords = fetchGameRecords()
let game = newGame;
// Load current game
if(window.user.id && window.game_id && savedGameRecords.gameRecords[window.user.id][window.game_id]) {
  console.log("Loading saved game: " + window.game_id);
  game = loadGameData(savedGameRecords.gameRecords[window.user.id][window.game_id]);
  game = initGameData(game);
}

// If not already created, create a static LNURL pay link to be used for sending sats to player
if(game.imported && !game.playerPayLinkCreated) {
  const playerPayLinkCreated = await createPlayerPayLNURL(game);
  if(playerPayLinkCreated) {
    game.playerPayLinkCreated = true; // Already saved in local storage
    // No need to save payLinkId and payLink in local storage (will be fetched from database by other players)
  } else {
    LNbits.utils.notifyApiError("Error creating player pay link")
  }
}

if(game.imported && !game.joined) {
  game.joined = true
  saveGameData(game, 'joined', game.joined)
  playPlayerJoinedSound();
}

if(game.fundingStatus == 'success' && !game.started && !game.showInviteButton) {
  // Show invite button only after redirection following onGameFunded() call
  game.showInviteButton = true
}

new Vue({
  el: '#vue',
  mixins: [windowMixin],
  data: function() {
    console.log()
    // const initializedGame = initGameData(game)
    return {
      gameRecords: savedGameRecords.gameRecords,
      gameRecordsData: savedGameRecords.gameRecordsData,
      game: game,
      camera: {
        data: null,
        show: false,
        track: null,
        camera: 'auto',
        capabilities: {},
        candidateDevices: [],
        constraints: {},
        tracksLength: 0,
        settings: {},
        deviceId: "",
        error: "OK",
        focus: {
          enabled: true,
          min: null,
          max: null,
        }
      },
      freeMarketCamera: false,
      qrCodeDialog: {
        data: null,
        show: false
      },
      fundingTab: 'paylnurl',
      // data for draggable cards
      enabled: true,
      isDragging: false,
      delayedDragging: false,
      // data for properties carousel
      carouselSlide: "",
    }
  },
  computed: {
    reactiveStyles: function() {
      return reactiveStyles(this.game)
    },
    // Draggable cards options
    dragOptions: function() {
      return dragOptions()
    }
  },
  watch: {
    // Draggable cards
    isDragging: function(newValue) {
      if (newValue) {
        this.delayedDragging = true;
        return;
      }
      this.$nextTick(() => {
        this.delayedDragging = false;
      });
    }
  },
  methods: {
    // Methods for QR code scanning
    onInitCamera: async function() {
      // Select video device (see: https://oberhofer.co/mediastreamtrack-and-its-capabilities/)
      const devices = await navigator.mediaDevices.enumerateDevices();
      devices.forEach((device) => {
        if(device.kind === "videoinput") {
          this.camera.candidateDevices.push(device)
        }
      })
      await this.selectCameraDevice(this.camera.candidateDevices.length - 1);
    },
    selectCameraDevice: async function(deviceIndex, retry = true) {
      this.camera.error = null;
      // Select last video device (usually camera with focus)
      try {
        if(deviceIndex >= 0 && deviceIndex < this.camera.candidateDevices.length) {
          this.camera.deviceId = this.camera.candidateDevices[deviceIndex].deviceId
          this.camera.constraints = {
            "video":  {
              "aspectRatio": 1,
              "facingMode": { "ideal":'environment' },
              "deviceId": { "exact": this.camera.deviceId }
            }
          }
        } else {
          this.camera.deviceId = "default"
          this.camera.constraints = {
            "video":  {
              "facingMode": { "ideal":'environment' }, // back camera on smartphone
              "aspectRatio": 1,
            }
          }
          retry = false;
        }
        const video = document.querySelector("video");
        const stream = await navigator.mediaDevices.getUserMedia(this.camera.constraints);
        video.srcObject = stream;
        // Wait for device to load
        video.addEventListener('loadedmetadata', (event) => {
          this.camera.track = stream.getVideoTracks()[0];
          this.camera.capabilities = stream.getVideoTracks()[0].getCapabilities();
          // Apply focusMode constraint if possible
          if(this.camera.capabilities.focusMode) {
            let continuousFocusAvailable = false;
            this.camera.capabilities.focusMode.forEach((focusMode) => {
              if (focusMode == "continuous") {
                continuousFocusAvailable = true;
              }
            })
            if(continuousFocusAvailable) {
              console.log("applying focus mode")
              stream.getVideoTracks()[0].applyConstraints({
                "focusMode": "continuous"
              })
            }
          }
          this.camera.settings = stream.getVideoTracks()[0].getSettings();
        });
      } catch(err) {
        console.error(err)
        this.camera.error = err
        // Stop camera
        if(this.camera.track) {
          this.camera.track.stop();
        }
        if(retry) {
          await this.selectCameraDevice(deviceIndex - 1, retry)
        }
      }
    },
    closeCamera: function() {
      this.camera.show = false;
      // Stop camera
      if(this.camera.track) {
        this.camera.track.stop();
      }
      // this.game.gameCreatorPaymentToMarket = false;
      this.freeMarketCamera = false;
    },
    onError: function(err) {
      console.error(err)
    },
    // Method for draggable cards
    onMove: function({ relatedContext, draggedContext }) {
      return onMove({ relatedContext, draggedContext })
    },
    onStartDrag: function() {
      this.isDragging = true;
      this.dragStartTime = Date.now();
    },
    onDragged: function({ oldIndex, newIndex }, color) {
      this.game = onDragged(this.game, this.dragStartTime, { oldIndex, newIndex }, color);
      this.isDragging = false;
    },
    onUpdateCarouselSlide: function(newSlide, oldSlide) {
      this.carouselSlide = onUpdateCarouselSlide(this.game, newSlide, oldSlide)
    },
    loadExistingGame: async function (gameId) {
      console.log("Loading saved game: " + gameId);
      const game = loadGameData(this.gameRecords[window.user.id][gameId]);
      this.game = initGameData(game);
      // Redirect to game.html
      window.location.href = "https://" + window.location.hostname + "/monopoly/game?usr=" + this.game.player.id + "&game_id=" + this.game.marketData.id;
    },
    // Logic to create a new game and a dedicated wallet for game creator (called from index.html)
    createGame: async function () {
      this.game.player.id = this.g.user.id;
      // Create free market wallet and dedicated player wallet for game creator
      await this.createFreeMarketWallet();
      // Check for payments to free market wallet
      this.checkPaymentsToFreeMarket();
      // Create a static LNURL pay link to be used for funding the free market
      await this.createFreeMarketPayLNURL();
      // Start checking free market balance
      this.checkMarketLiquidity()
      // Display the view for initial free market funding
      this.game.showFundingView = true;
      // Save game data in local storage
      saveGameData(game, 'showFundingView', this.game.showFundingView)
      // Redirect to game.html
      window.location.href = "https://" + window.location.hostname + "/monopoly/game?usr=" + this.game.player.id + "&game_id=" + this.game.marketData.id;
    },
    // Logic to create free market wallet
    createFreeMarketWallet: async function () {
      // Create free market wallet
      let res = await LNbits.api
        .request(
          'POST',
          '/usermanager/api/v1/users',
          this.g.user.wallets[0].inkey,
          {
            admin_id: this.g.user.id,
            user_name: "Free market",
            wallet_name: "Free market liquidity",
            email: "",
            password: ""
          }
        )
      if(res.data) {
        this.game.marketData = res.data
        console.log("Monopoly: Free market wallet created successfully")
        // Register game in database
        res = await LNbits.api
          .request(
            'POST',
            '/monopoly/api/v1/games',
            this.g.user.wallets[0].inkey,
            {
              admin_user_id: this.g.user.id, // LNBits user_id of game creator
              game_id: this.game.marketData.id, // wallet_id of game's free market wallet
              max_players_count: this.game.maxPlayersCount,
              cumulated_fines: 0,
              available_player_names: playerNames,
            }
          )
        if(res.data) {
          console.log("Monopoly: Game registered successfully (" + res.config.data+ ")")
          this.game.created = true
          this.game.fundingStatus = 'awaiting'
          this.game.timestamp = Date.now()
          // Save new game in local storage
          saveGameRecord(this.game)
        } else {
          LNbits.utils.notifyApiError(res.error)
        }
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
    },
    // Logic to create dedicated player wallet for game creator
    createPlayerWallet: async function () {
      // Create player wallet
      let res = await LNbits.api
        .request(
          'POST',
          '/monopoly/api/v1/player',
          this.g.user.wallets[0].inkey,
          {
            game_id: this.game.marketData.id,
            user_id: this.g.user.id
          }
        )
      if(res.data) {
        console.log("Monopoly: Player wallet created successfully (" + res.data.id + ", " + res.data.player_wallet_id + ")")
        this.game.player.wallet_id = res.data.player_wallet_id
        this.game.player.index = parseInt(res.data.player_index)
        this.game.playersCount = 1;
        saveGameData(this.game, 'player', this.game.player)
        saveGameData(this.game, 'playersCount', this.game.playersCount)
      }
    },
    // Logic to update game creator's dedicated player wallet with random player name
    updatePlayerWallet: async function () {
      // Update player wallet
      let res = await LNbits.api
        .request(
          'PUT',
          '/monopoly/api/v1/player',
          this.g.user.wallets[0].inkey,
          {
            game_id: this.game.marketData.id,
            player_wallet_id: this.game.player.wallet_id
          }
        )
      if(res.data) {
        console.log("Monopoly: Player wallet updated successfully (" + res.data.id + ")")
        this.g.user.wallets.push(res.data)
        this.game.player.name = res.data.name;
        this.game.player.wallets.push(res.data);
        saveGameData(this.game, 'player', this.game.player)
      }
    },
    // Logic to create a static LNURL pay link to be used for funding the free market
    createFreeMarketPayLNURL: async function () {
      const payLNURLData = {
        description: "Free market pay link",
        min: 1,
        max: 1000000,
        comment_chars: 100,
        success_text: "Payment to free market confirmed"
      }
      // Create LNURL pay link
      let res = await LNbits.api
        .request('POST', '/lnurlp/api/v1/links', this.game.marketData.wallets[0].adminkey, payLNURLData);
      if(res.data) {
        const payLinkId = res.data.id
        const payLink = res.data.lnurl
        // Register LNURL pay link in database
        res = await LNbits.api
          .request(
            'POST',
            '/monopoly/api/v1/games/paylink',
            this.g.user.wallets[0].inkey,
            {
              game_id: this.game.marketData.id,
              pay_link_id: payLinkId,
              pay_link: payLink
            }
          )
        if(res.data) {
          console.log("Monopoly: LNURL pay link created successfully " + payLink)
          // Save lnurl pay link id in local storage
          this.game.lnurlPayLinkId = payLinkId;
          this.game.lnurlPayLink = payLink;
          saveGameData(this.game, 'lnurlPayLinkId', this.game.lnurlPayLinkId)
          saveGameData(this.game, 'lnurlPayLink', this.game.lnurlPayLink)
        } else {
          LNbits.utils.notifyApiError(res.error)
        }
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
    },
    // Logic to create a static LNURL pay link to be used for sending sats to player
    createPlayerPayLNURL: async function () {
      const playerPayLinkCreated = await createPlayerPayLNURL(this.game);
      if(playerPayLinkCreated) {
        this.game.playerPayLinkCreated = true; // Already saved in local storage
        // No need to save payLinkId and payLink in local storage (will be fetched from database by other players)
      } else {
        LNbits.utils.notifyApiError("Error creating player pay link")
      }
    },
    initializeCards: async function () {
      // Initialize Lightning and Protocol cards indexes
      const res = await LNbits.api
        .request(
          'POST',
          '/monopoly/api/v1/cards/init_cards_indexes',
          user.wallets[0].inkey,
          {
            game_id: this.game.marketData.id
          },
        )
      if(res.status == 201) {
        console.log("Monopoly: Lightning and Protocol cards indexes initialized successfully ")
      }
    },
    // Logic to format an invite link to invite other players to the game
    formatInviteLink: async function () {
      // Get voucher from database using the free market invoice key
      let res = await LNbits.api
        .request(
          'GET',
          '/withdraw/api/v1/links/' + this.game.inviteVoucherId,
          this.game.marketData.wallets[0].inkey
        )
      if(res.data) {
        const inviteVoucher = res.data.lnurl;
        res = await LNbits.api
          .request(
            'GET',
            '/withdraw/api/v1/links/' + this.game.rewardVoucherId,
            this.game.marketData.wallets[0].inkey
          )
        if(res.data) {
          const rewardVoucher = res.data.lnurl;
          return "https://" + window.location.hostname +
            "/monopoly/api/v1/invite?game_id=" + this.game.marketData.id +
            "&invite_voucher=" + inviteVoucher +
            "&reward_voucher=" + rewardVoucher;
        } else {
          LNbits.utils.notifyApiError(res.error)
        }
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
    },
    // Logic to create an invoice to fund the free market wallet
    createFundingInvoice: async function (invoiceReason = null) {
      // Erase previous funding invoice
      this.game.fundingInvoice.paymentReq = null
      this.game.fundingInvoice = newGame.fundingInvoice
      if(this.game.fundingInvoiceAmount && this.game.fundingInvoiceAmount > 0) {
        // Generate new funding invoice
        this.game.fundingInvoice.data.amount = this.game.fundingInvoiceAmount
        if (LNBITS_DENOMINATION !== 'sats') {
          this.game.fundingInvoice.data.amount = this.game.fundingInvoice.data.amount * 100
        }
        let res = await LNbits.api.createInvoice(
          this.game.marketData.wallets[0],
          this.game.fundingInvoice.data.amount,
          this.game.fundingInvoice.data.memo,
          this.game.fundingInvoice.unit,
          this.game.fundingInvoice.lnurl && this.game.fundingInvoice.lnurl.callback
        )
        if(res.data) {
          this.game.fundingInvoice.paymentReq = res.data.payment_request
          this.game.fundingInvoice.paymentHash = res.data.payment_hash
          // Save funding invoice in local storage
          saveGameData(this.game, 'fundingInvoice', this.game.fundingInvoice)
          // Once invoice has been created and saved, start checking for payments
          this.checkFundingInvoicePaid(invoiceReason)
        } else {
          LNbits.utils.notifyApiError(res.error)
        }
      } else  {
        LNbits.utils.notifyApiError('Error: invalid game.fundingInvoiceAmount')
        this.game.fundingStatus = 'error'
      }
    },
    // Logic to create a simplified invoice for player to request funds
    createPlayerInvoice: async function(invoiceReason = null) {
      if(this.game.playerInvoiceAmount && this.game.playerInvoiceAmount > 0) {
        this.game.playerInvoice = {
          qr: "I" + this.game.player.index.toString() + this.game.playerInvoiceAmount.toString(),
          amount: this.game.playerInvoiceAmount
        };
        this.game.playerInvoiceAmount = null;
      }
    },
    copyPlayerInvoice: async function() {
      // Generate an actual LN invoice to copy
      this.game.playerInvoice.paymentReq = null
      this.game.playerInvoice.paymentHash = null
      this.game.playerInvoice.invoiceAmount = null
      if(this.game.playerInvoice.amount && this.game.playerInvoice.amount > 0) {
        // Generate new player invoice
        this.game.playerInvoice.invoiceAmount = this.game.playerInvoice.amount
        if (LNBITS_DENOMINATION !== 'sats') {
          this.game.playerInvoice.invoiceAmount = this.game.playerInvoice.amount * 100
        }
        let res = await LNbits.api.createInvoice(
          this.game.player.wallets[0],
          this.game.playerInvoice.invoiceAmount,
          this.game.playerInvoice.amount.toString() + 'sats payment to ' + this.game.player.name,
          'sat',
          null
        )
        if(res.data) {
          this.game.playerInvoice.paymentReq = res.data.payment_request
          this.game.playerInvoice.paymentHash = res.data.payment_hash
          // Save player invoice in local storage
          saveGameData(this.game, 'playerInvoice', this.game.playerInvoice)
          // Once invoice has been created and saved, start checking for payments
          this.checkPlayerInvoicePaid(this.game)
          // Copy player invoice paymentReq to clipboard
          await navigator.clipboard.writeText(this.game.playerInvoice.paymentReq)
        } else {
          LNbits.utils.notifyApiError(res.error)
        }
      } else  {
        LNbits.utils.notifyApiError('Error: invalid game.playerInvoice.amount')
      }
    },
    // Logic to create a simplified invoice for free market to request funds
    createFreeMarketInvoice: async function (invoiceReason = null) {
      if(this.game.freeMarketInvoiceAmount && this.game.freeMarketInvoiceAmount > 0) {
        this.game.freeMarketInvoice = {
          qr: "I0" + this.game.freeMarketInvoiceAmount.toString(),
          amount: this.game.freeMarketInvoiceAmount
        };
        this.game.freeMarketInvoiceAmount = null;
      }
    },
    copyFreeMarketInvoice: async function() {
      // Generate an actual LN invoice to copy
      this.game.freeMarketInvoice.paymentReq = null
      this.game.freeMarketInvoice.paymentHash = null
      this.game.freeMarketInvoice.invoiceAmount = null
      if(this.game.freeMarketInvoice.amount && this.game.freeMarketInvoice.amount > 0) {
        // Generate new player invoice
        this.game.freeMarketInvoice.invoiceAmount = this.game.freeMarketInvoice.amount
        if (LNBITS_DENOMINATION !== 'sats') {
          this.game.freeMarketInvoice.invoiceAmount = this.game.freeMarketInvoice.amount * 100
        }
        let res = await LNbits.api.createInvoice(
          this.game.marketData.wallets[0],
          this.game.freeMarketInvoice.invoiceAmount,
          this.game.freeMarketInvoice.amount.toString() + 'sats payment to free market',
          'sat',
          null
        )
        if(res.data) {
          this.game.freeMarketInvoice.paymentReq = res.data.payment_request
          this.game.freeMarketInvoice.paymentHash = res.data.payment_hash
          // Save player invoice in local storage
          saveGameData(this.game, 'freeMarketInvoice', this.game.freeMarketInvoice)
          // Once invoice has been created and saved, start checking for payments
          this.checkFreeMarketInvoicePaid(this.game)
          // Copy player invoice paymentReq to clipboard
          await navigator.clipboard.writeText(this.game.freeMarketInvoice.paymentReq)
        } else {
          LNbits.utils.notifyApiError(res.error)
        }
      } else  {
        LNbits.utils.notifyApiError('Error: invalid game.freeMarketInvoice.amount')
      }
    },
    // Logic to create a static LNURL withdraw link to be used as an offer for buying a property
    createPlayerWithdrawLNURL: async function () {
      const voucherData = {
        custom_url: null,
        is_unique: true,
        max_withdrawable: this.game.playerVoucherAmount,
        min_withdrawable: this.game.playerVoucherAmount,
        title: "Monopoly game voucher",
        use_custom: false,
        wait_time: 1,
        uses: 1
      }
      // Create LNURL withdraw link
      let res = await LNbits.api
        .request('POST', '/withdraw/api/v1/links', game.player.wallets[0].adminkey, voucherData);
      if(res.data) {
        console.log("Monopoly: player withdraw LNURL created successfully")
        this.game.playerVoucherId = res.data.id;
        this.game.playerVoucher = res.data.lnurl;
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
    },
    // Logic to display the free market funding dialog component
    showFundingDialog: function () {
      this.game.showFundingDialog = true
    },
    // Logic to display the invite link QR code
    showInviteQR: async function () {
      this.game.inviteLink = await this.formatInviteLink();
      this.game.showInviteQR = true
    },
    // Logic to start the game (called from index.html)
    startGame: async function () {
      // Delete game voucher now that all players joined and claimed their sats
      await this.deleteInviteVoucher()
      // Stop checking for new players
      clearInterval(game.playersChecker)
      // Initialize Lightning and Protocol cards indexes
      await this.initializeCards()
      // Start checking player turn
      await fetchPlayerTurn(this.game)
      this.checkPlayerTurn()
      // Start game
      this.game.started = true;
      // Save game status in database
      const res = await LNbits.api
        .request(
          'PUT',
          '/monopoly/api/v1/games/start',
          user.wallets[0].inkey,
          {
            game_id: this.game.marketData.id,
            started: this.game.started
          }
        )
      if(res.data) {
        // Save game status in local storage
        saveGameData(this.game, 'started', this.game.started)
        console.log("GAME STARTED")
      }
    },
    incrementPlayerTurn: async function () {
      const res = await LNbits.api
        .request(
          'PUT',
          '/monopoly/api/v1/games/increment_player_turn',
          this.game.player.wallets[0].inkey,
          {
            game_id: this.game.marketData.id,
          }
        )
      if(res.data) {
        console.log("Current player turn: " + res.data)
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
    },
    deleteInviteVoucher: async function () {
      await deleteInviteVoucher(this.game)
    },
    checkFundingInvoicePaid: function (invoiceReason = null) {
      checkFundingInvoicePaid(this.game, invoiceReason)
    },
    checkPaymentsToFreeMarket: function () {
      checkPaymentsToFreeMarket(this.game)
    },
    checkPaymentsToPlayer: function () {
      checkPaymentsToPlayer(this.game)
    },
    checkPlayerInvoicePaid: function (invoiceReason = null) {
      checkPlayerInvoicePaid(this.game, invoiceReason)
    },
    checkFreeMarketInvoicePaid: function (invoiceReason = null) {
      checkFreeMarketInvoicePaid(this.game, invoiceReason)
    },
    // Called from game.html
    onGameFunded: async function () {
      // Create player wallet for game creator
      await this.createPlayerWallet()
      // Update player wallet for game creator (pick random name)
      await this.updatePlayerWallet();
      // Create a static LNURL pay link to be used for sending sats to player
      await this.createPlayerPayLNURL();
      // Check for payments to player wallet
      this.checkPaymentsToPlayer();
      // Start checking player balance
      await fetchPlayerBalance(this.game)
      this.checkPlayerBalance()
      // Start checking players
      await fetchPlayers(this.game)
      this.checkPlayers()
      // Start checking players balances
      this.checkPlayersBalances()

      onGameFunded(this.game)
    },
    showExplanationText: async function () {
      this.game.showExplanationText = true
    },
    hideExplanationText: async function () {
      this.game.showExplanationText = false
    },
    showPlayerInvoiceDialog: async function () {
      this.game.showPlayerInvoiceDialog = true
    },
    closePlayerInvoiceDialog: async function () {
      this.game.showPlayerInvoiceDialog = false
    },
    showFreeMarketInvoiceDialog: async function () {
      this.game.showFreeMarketInvoiceDialog = true
    },
    closeFreeMarketInvoiceDialog: async function () {
      this.game.showFreeMarketInvoiceDialog = false
    },
    // Functions interfaces
    checkPlayerBalance: async function () {
      await checkPlayerBalance(this.game)
    },
    checkPlayers: async function () {
      await checkPlayers(this.game)
    },
    checkPlayersBalances: async function () {
      await checkPlayersBalances(this.game)
    },
    checkPlayerTurn: async function () {
      await checkPlayerTurn(this.game)
    },
    checkMarketLiquidity: async function () {
      await checkMarketLiquidity(this.game)
    },
    closeReceiveDialog: function () {
      this.game.showFundingDialog = false
    },
    closeInviteQR: function () {
      this.game.showInviteQR = false
    },
    getFundingInvoiceAmount: function () {
      return this.game.fundingInvoiceAmount
    },
    showPropertyDetails: function (property) {
      this.game.showPropertyDialog = true;
      this.game.propertyToShow = property;
    },
    getNetworkFeeInvoiceAmount: async function (property) {
      this.game.showSaleInvoiceDialog = false;
      this.erasePropertyInvoices()
      switch(property.color) {
        case("bfbfbf"):
          // Invoice network fee for mining pools
          let miningPoolsCount = this.game.properties[this.game.player.wallets[0].id]["bfbfbf"].length;
          this.game.playerInvoiceAmount = property.networkFee[miningPoolsCount - 1]
          await this.createNetworkFeeInvoice(property);
          break;
        case("00ff00"):
          // Invoice network fee for wrench attack
          switch(property.id) {
            case 0:
              this.game.customNetworkFeeMultiplier = 1;
              this.game.showNetworkFeeInvoiceDialog = true;
              break;
            case 1:
              this.game.playerInvoiceAmount = 75;
              await this.createNetworkFeeInvoice(property);
              break;
            default: throw("Wrench attack fee invoice error: unknown property id");
          }
          break;
        case("00FFFF"):
          // Invoice network fee for energy companies
          let energyCompaniesCount = this.game.properties[this.game.player.wallets[0].id]["00FFFF"].length;
          switch(energyCompaniesCount) {
            case 1:
              this.game.customNetworkFeeMultiplier = 4;
              break;
            case 2:
              this.game.customNetworkFeeMultiplier = 10;
              break;
            default: throw("Energy company fee invoice error: invalid energy companies count");
          }
          this.game.showNetworkFeeInvoiceDialog = true;
          break;
        default:
          // Invoice network fee for regular propertiees
          this.game.playerInvoiceAmount = property.networkFee[property.mining_capacity];
          await this.createNetworkFeeInvoice(property);
      }
    },
    createNetworkFeeInvoice: async function(property) {
      if(!this.game.playerInvoiceAmount) {
        this.game.playerInvoiceAmount = this.game.customNetworkFeeInvoiceAmount * this.game.customNetworkFeeMultiplier;
      }
      this.game.networkFeeInvoiceData = {
        qr: "N" + property.color + property.id + this.game.playerInvoiceAmount.toString(),
        amount: this.game.playerInvoiceAmount
      };
      this.game.showPropertyDialog = false;
      this.game.showPropertyInvoiceDialog = true;
      this.game.showNetworkFeeInvoice = true;
      this.game.showNetworkFeeInvoiceDialog = false;
      this.game.playerInvoiceAmount = null;
      this.game.customNetworkFeeInvoiceAmount = null;
      this.game.customNetworkFeeMultiplier = null;
    },
    openSaleInvoiceDialog: async function (property) {
      this.erasePropertyInvoices()
      this.game.showPropertyDialog = false;
      this.game.showPropertyInvoiceDialog = true;
      this.game.showSaleInvoiceDialog = true;
    },
    createSaleInvoice: async function (property, amount) {
      this.erasePropertyInvoices()
      this.game.playerInvoiceAmount = amount;
      this.game.propertySaleData = {
        qr: "S" + property.color + property.id + this.game.playerInvoiceAmount.toString(),
        amount: this.game.playerInvoiceAmount
      };
      this.game.saleInvoiceCreated = true;
      this.game.playerInvoiceAmount = null;
    },
    createOfferVoucher: async function (property) {
      this.erasePropertyInvoices()
      this.game.showPropertyDialog = false;
      this.game.offerVoucher = true;
      this.game.showPropertyInvoiceDialog = true;
    },
    closePropertyDialog: function () {
      this.game.showPropertyDialog = false;
      this.game.propertyToShow = {};
    },
    closePropertyInvoiceDialog: function () {
      this.game.showPropertyInvoiceDialog = false;
      this.game.showSaleInvoiceDialog = false;
      this.game.showPropertyDialog = true;
    },
    closePropertyPurchaseDialog: function () {
      this.game.showPropertyPurchaseDialog = false;
      this.game.showPropertyDialog = false;
      this.game.propertyToShow = {};
    },
    closePropertyUpgradeDialog: function () {
      this.game.showPropertyUpgradeDialog = false;
    },
    closeNetworkFeeInvoiceDialog: function () {
      this.game.showNetworkFeeInvoice = false;
    },
    closeNetworkFeePaymentDialog: function () {
      this.game.showNetworkFeePaymentDialog = false;
    },
    closePayInvoiceDialog: function () {
      this.game.showPayInvoiceDialog = false;
      this.game.invoice = null;
      this.game.invoiceAmount = "0";
    },
    closePayInvoiceOnBehalfOfFreeMarketDialog: function () {
      this.game.showPayInvoiceOnBehalfOfFreeMarketDialog = false;
      this.game.invoice = null;
      this.game.invoiceAmount = "0";
    },
    erasePropertyInvoices: function() {
      this.game.showNetworkFeeInvoice = false;
      this.game.showNetworkFeeInvoice = false;
      this.game.propertyPurchaseData = null;
      this.game.propertySaleData = null;
      this.game.playerInvoiceAmount = null;
      this.game.customNetworkFeeInvoiceAmount = null;
      this.game.customNetworkFeeMultiplier = null;
      this.game.playerInvoice = newGame.playerInvoice;
      this.game.fundingInvoice.paymentReq = null;
      this.game.fundingInvoice = newGame.fundingInvoice;
      this.game.playerVoucherId = null;
      this.game.playerVoucher = null;
      this.game.networkFeeInvoiceCreated = false;
      this.game.networkFeeInvoiceData = null;
      this.game.networkFeeInvoice = {};
      this.game.saleInvoiceCreated = false;
      this.game.upgradeInvoice = false;
      this.game.purchaseInvoiceCreated = false;
      this.game.offerVoucher = false;
      this.game.upgradeInvoiceCreated = false;
      this.game.propertyUpgradeData = null;
    },
    payInvoice: async function() {
      if(this.game.invoice.slice(0, 2) == "ln") {
        // Pay invoice
        console.log(this.game.invoice)
        console.log("Paying invoice...")
        let res = await LNbits.api.payInvoice(this.game.player.wallets[0], this.game.invoice);
        if(res.data && res.data.payment_hash) {
          console.log("Invoice paid successfully")
          this.closePayInvoiceDialog()
        } else {
          LNbits.utils.notifyApiError(res.error)
        }
      } else {
        // Get invoice recipient's pay link
        let invoiceRecipientPayLink;
        if(this.game.invoiceRecipientIndex === "0") {
          invoiceRecipientPayLink = this.game.lnurlPayLink
        } else {
          let res = await LNbits.api
            .request(
              'GET',
              '/monopoly/api/v1/players/pay_link?player_wallet_id=' + this.game.invoiceRecipientWalletId,
              this.game.player.wallets[0].inkey
            )
          if(res.data) {
            invoiceRecipientPayLink = res.data.player_pay_link
          } else {
            LNbits.utils.notifyApiError(res.error)
          }
        }
        //Get lnurl pay data
        let lnurlData = await decodeLNURL(invoiceRecipientPayLink, this.game.player.wallets[0])
        // Pay invoice to invoice recipient's pay link
        console.log("Paying to invoice recipient's pay link...")
        let res = await LNbits.api.payLnurl(
          this.game.player.wallets[0],
          lnurlData.callback,
          lnurlData.description_hash,
          this.game.invoiceAmount * 1000, // mSats
          'Bitcoin Monopoly: player invoice',
          ''
        )
        if(res.data && res.data.payment_hash) {
          console.log("Player invoice was paid successfully")
          this.closePayInvoiceDialog()
        } else {
          LNbits.utils.notifyApiError(res.error)
        }
      }
    },
    payInvoiceOnBehalfOfFreeMarket: async function() {
      if(this.game.invoice.slice(0, 2) == "ln") {
        // Pay invoice
        console.log(this.game.invoice)
        console.log("Paying invoice on behalf of the free market...")
        let res = await LNbits.api.payInvoice(this.game.marketData.wallets[0], this.game.invoice);
        if(res.data && res.data.payment_hash) {
          console.log("Invoice paid successfully")
          this.closePayInvoiceOnBehalfOfFreeMarketDialog()
        } else {
          LNbits.utils.notifyApiError(res.error)
        }
      } else {
        // Get invoice recipient's pay link
        let res = await LNbits.api
          .request(
            'GET',
            '/monopoly/api/v1/players/pay_link?player_wallet_id=' + this.game.invoiceRecipientWalletId,
            this.game.player.wallets[0].inkey
          )
        if(res.data) {
          let invoiceRecipientPayLink = res.data.player_pay_link
          //Get lnurl pay data
          let lnurlData = await decodeLNURL(invoiceRecipientPayLink, this.game.marketData.wallets[0])
          // Pay invoice to invoice recipient's pay link
          console.log("Paying to invoice recipient's pay link on behalf of the free market...")
          res = await LNbits.api.payLnurl(
            this.game.marketData.wallets[0],
            lnurlData.callback,
            lnurlData.description_hash,
            this.game.invoiceAmount * 1000, // mSats
            'Bitcoin Monopoly: player invoice',
            ''
          )
          if(res.data && res.data.payment_hash) {
            console.log("Player invoice was paid successfully")
            this.closePayInvoiceOnBehalfOfFreeMarketDialog()
          } else {
            LNbits.utils.notifyApiError(res.error)
          }
        } else {
          LNbits.utils.notifyApiError(res.error)
        }
      }
    },
    purchaseProperty: async function() {
      console.log("Purchasing property...")
      if(!this.game.purchasingProperty) {
        try {
          this.game.purchasingProperty = true; // Prevent purchasing multiple times
          // Check if property is already registered in database
          let res = await LNbits.api
            .request(
              'GET',
              '/monopoly/api/v1/property?game_id=' + this.game.marketData.id
              + '&property_color=' + this.game.propertyPurchase.property.color
              + '&property_id=' + this.game.propertyPurchase.property.id,
              this.game.player.wallets[0].inkey,
            )
          if(res.data) {
            console.log("Property already registered...")
            // Get property owner Id
            let propertyOwnerId;
            Object.keys(this.game.properties).forEach((ownerId) => {
              if(this.game.properties[ownerId][this.game.propertyPurchase.property.color]) {
                this.game.properties[ownerId][this.game.propertyPurchase.property.color].forEach((property) => {
                  if(property.id ===  this.game.propertyPurchase.property.id) {
                    propertyOwnerId = property.owner;
                  }
                });
              }
            });
            // Get property owner's pay link
            res = await LNbits.api
              .request(
                'GET',
                '/monopoly/api/v1/players/pay_link?player_wallet_id=' + propertyOwnerId,
                this.game.player.wallets[0].inkey
              )
            if(res.data) {
              let propertyOwnerPayLink = res.data.player_pay_link
              //Get lnurl pay data
              let lnurlData = await decodeLNURL(propertyOwnerPayLink, this.game.player.wallets[0])
              // Pay property price to property owner's pay link
              console.log("Paying property purchase to property owner's pay link...")
              res = await LNbits.api.payLnurl(
                this.game.player.wallets[0],
                lnurlData.callback,
                lnurlData.description_hash,
                this.game.propertyPurchase.property.price * 1000, // mSats
                'Bitcoin Monopoly: property purchase',
                ''
              )
              if(res.data && res.data.payment_hash) {
                console.log("Property purchase was paid successfully")
                console.log("Updating property ownership")
                await this.transferPropertyOwnership(this.game.propertyPurchase.property, this.game.player.wallets[0].id)
                this.closePropertyPurchaseDialog()
                this.game.purchasingProperty = false;
              } else {
                this.game.purchasingProperty = false
                LNbits.utils.notifyApiError(res.error)
              }
            } else {
              this.game.purchasingProperty = false
              LNbits.utils.notifyApiError(res.error)
            }
          } else {
            console.log("Property is not yet registered...")
            //Get lnurl pay data
            let lnurlData = await decodeLNURL(this.game.lnurlPayLink, this.game.player.wallets[0])
            // Pay property purchase to free market pay link
            console.log("Paying property purchase to free market pay link...")
            res = await LNbits.api.payLnurl(
              this.game.player.wallets[0],
              lnurlData.callback,
              lnurlData.description_hash,
              this.game.propertyPurchase.property.price * 1000, // mSats
              'Bitcoin Monopoly: property purchase',
              ''
            )
            if(res.data && res.data.payment_hash) {
              console.log("Property purchase was paid successfully")
              console.log("Registering property")
              await this.registerProperty(this.game.propertyPurchase.property, this.game.player.wallets[0].id)
              this.closePropertyPurchaseDialog()
              this.game.purchasingProperty = false
            } else {
              this.game.purchasingProperty = false
              LNbits.utils.notifyApiError(res.error)
            }
          }
          // Switch carouselSlide value to property color to display newly purchased property
          this.carouselSlide = this.game.propertyPurchase.property.color
        } catch(err) {
          this.game.purchasingProperty = false
          LNbits.utils.notifyApiError(err)
        }
      }
    },
    registerProperty: async function(property, buyer) {
      let res = await LNbits.api
        .request(
          'POST',
          '/monopoly/api/v1/property',
          this.game.player.wallets[0].inkey,
          {
            property_id: property.id,
            property_color: property.color,
            property_owner_id: buyer,
            property_mining_capacity: 0,
            property_mining_income: 0,
            game_id: this.game.marketData.id
          }
        )
      if(res.data) {
        console.log("Property registered successfully")
        console.log(res.data)
      }
    },
    transferPropertyOwnership: async function(property, buyer) {
      let res = await LNbits.api
        .request(
          'PUT',
          '/monopoly/api/v1/property/transfer-ownership',
          this.game.player.wallets[0].inkey,
          {
            game_id: this.game.marketData.id,
            property_color: property.color,
            property_id: property.id,
            new_owner: buyer
          }
        )
      if(res.data) {
        console.log("Property ownership transferred successfully")
        console.log(res.data)
      }
    },
    upgradeProperty: async function() {
      if(!this.game.upgradingProperty) {
        this.game.upgradingProperty = true // Prevent upgrading multiple times
        //Get lnurl pay data
        let lnurlData = await decodeLNURL(this.game.lnurlPayLink, this.game.player.wallets[0])
        console.log("Upgrading property...")
        // Pay property upgrade to free market pay link
        console.log("Paying property upgrade to free market pay link...")
        let res = await LNbits.api.payLnurl(
          this.game.player.wallets[0],
          lnurlData.callback,
          lnurlData.description_hash,
          this.game.propertyUpgrade.price * 1000, // mSats
          'Bitcoin Monopoly: property upgrade',
          ''
        )
        if(res.data && res.data.payment_hash) {
          console.log("Property upgrade was paid successfully")
          this.closePropertyUpgradeDialog()
          console.log("Updating property's mining capacity")
          await this.upgradePropertyMiningCapacity(this.game.propertyUpgrade.property)
          this.game.upgradingProperty = false
        } else {
          this.game.upgradingProperty = false
          LNbits.utils.notifyApiError(res.error)
        }
      }
    },
    upgradePropertyMiningCapacity: async function(property) {
      let res = await LNbits.api
        .request(
          'PUT',
          '/monopoly/api/v1/property/upgrade',
          this.game.player.wallets[0].inkey,
          {
            game_id: this.game.marketData.id,
            property_color: property.color,
            property_id: property.id
          }
        )
      if(res.data) {
        console.log("Property's mining capacity upgraded successfully")
        console.log(res.data)
      }
    },
    payNetworkFee: async function() {
      if(!this.game.payingNetworkFee) {
        console.log("Paying network fee...")
        this.game.payingNetworkFee = true // Prevent paying multiple times
        // Get property owner Id
        let propertyOwnerId;
        Object.keys(this.game.properties).forEach((ownerId) => {
          if(this.game.properties[ownerId][this.game.networkFeeInvoice.property.color]) {
            this.game.properties[ownerId][this.game.networkFeeInvoice.property.color].forEach((property) => {
              if(property.id ===  this.game.networkFeeInvoice.property.id) {
                propertyOwnerId = property.owner;
              }
            });
          }
        });
        // Get property owner's pay link
        let res = await LNbits.api
          .request(
            'GET',
            '/monopoly/api/v1/players/pay_link?player_wallet_id=' + propertyOwnerId,
            this.game.player.wallets[0].inkey
          )
        if(res.data) {
          let propertyOwnerPayLink = res.data.player_pay_link
          //Get lnurl pay data
          let lnurlData = await decodeLNURL(propertyOwnerPayLink, this.game.player.wallets[0])
          // Pay network fee to property owner's pay link
          console.log("Paying network fee to property owner's pay link...")
          res = await LNbits.api.payLnurl(
            this.game.player.wallets[0],
            lnurlData.callback,
            lnurlData.description_hash,
            this.game.networkFeeInvoice.invoiceAmount * 1000, // mSats
            'Bitcoin Monopoly: network fee',
            ''
          )
          if(res.data && res.data.payment_hash) {
            console.log("Network fee was paid successfully")
            this.closeNetworkFeePaymentDialog()
            console.log("Updating property's cumulated mining income")
            await this.updatePropertyMiningIncome(this.game.networkFeeInvoice.property, this.game.networkFeeInvoice.invoiceAmount)
            this.game.payingNetworkFee = false
          } else {
            this.game.payingNetworkFee = false
            LNbits.utils.notifyApiError(res.error)
          }
        } else {
          this.game.payingNetworkFee = false
          LNbits.utils.notifyApiError(res.error)
        }
      }
    },
    updatePropertyMiningIncome: async function(property, amount) {
      let res = await LNbits.api
        .request(
          'PUT',
          '/monopoly/api/v1/property/update-income',
          this.game.player.wallets[0].inkey,
          {
            game_id: this.game.marketData.id,
            property_color: property.color,
            property_id: property.id,
            income_increment: amount
          }
        )
      if(res.data) {
        console.log("Property's cumulated mining income updated successfully")
        console.log(res.data)
      }
    },
    showLightningCard: async function() {
      let res = await LNbits.api
        .request(
          'GET',
          '/monopoly/api/v1/next_lightning_card_index?game_id=' + this.game.marketData.id,
          this.game.player.wallets[0].inkey,
        )
      if(res.data) {
        let lightningCard = res.data
        let cardIndex;
        if(this.game.firstLightningCardThisTurn) {
          this.game.firstLightningCardThisTurn = false
          saveGameData(this.game, 'firstLightningCardThisTurn', this.game.firstLightningCardThisTurn)
          cardIndex = lightningCard.next_index
          // Update next Lightning card index if it's the first time that player is picking the card in this turn
          console.log("Updating next lightning card index")
          res = await LNbits.api
              .request(
                  'PUT',
                  '/monopoly/api/v1/cards/update_next_card_index',
                  this.game.player.wallets[0].inkey,
                  {
                    game_id: this.game.marketData.id,
                    card_type: "lightning",
                  }
              )
          if(res.data) {
            console.log("Next Lightning card index updated successfully")
          } else {
            LNbits.utils.notifyApiError(res.error)
          }
        } else {
          cardIndex = (lightningCard.next_index - 1) % 16
        }
        console.log("Showing Lightning card at index " + cardIndex.toString())
        console.log(lightning_cards[cardIndex.toString()].imgPath)
        this.game.showLightningCard = true;
        this.game.lightningCardToShow = lightning_cards[cardIndex.toString()];
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
    },
    showProtocolCard: async function() {
      let res = await LNbits.api
        .request(
          'GET',
          '/monopoly/api/v1/next_protocol_card_index?game_id=' + this.game.marketData.id,
          this.game.player.wallets[0].inkey,
        )
      if(res.data) {
        let protocolCard = res.data
        let cardIndex;
        if(this.game.firstProtocolCardThisTurn) {
          this.game.firstProtocolCardThisTurn = false
          saveGameData(this.game, 'firstProtocolCardThisTurn', this.game.firstProtocolCardThisTurn)
          cardIndex = protocolCard.next_index
          // Update next Protocol card index if it's the first time that player is picking the card in this turn
          console.log("Updating next protocol card index")
          res = await LNbits.api
              .request(
                  'PUT',
                  '/monopoly/api/v1/cards/update_next_card_index',
                  this.game.player.wallets[0].inkey,
                  {
                    game_id: this.game.marketData.id,
                    card_type: "protocol"
                  }
              )
          if(res.data) {
            console.log("Next Protocol card index updated successfully")
            console.log(res.data)
          }
        } else {
          cardIndex = (protocolCard.next_index - 1) % 16
        }
        console.log("Showing Protocol card at index " + cardIndex.toString())
        console.log(protocol_cards[cardIndex.toString()].imgPath)
        this.game.showProtocolCard = true;
        this.game.protocolCardToShow = protocol_cards[cardIndex.toString()];
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
    },
    showWrenchAttackDialog: function(wrenchAttackIndex) {
      this.game.wrenchAttackAmountSats = wrenchAttackIndex === "0"
        ? Math.max(200, 0.1 * this.game.userBalance)
        : 75
        this.game.showWrenchAttackDialog = true
    },
    payWrenchAttack: async function() {
      //Get lnurl pay data
      let lnurlData = await decodeLNURL(this.game.lnurlPayLink, this.game.player.wallets[0])
      // Pay wrench attack
      console.log("Paying wrench attack...")
      let res = await LNbits.api.payLnurl(
        this.game.player.wallets[0],
        lnurlData.callback,
        lnurlData.description_hash,
        this.game.wrenchAttackAmountSats * 1000, // mSats
        'Bitcoin Monopoly: wrench attack',
        ''
      )
      if(res.data && res.data.payment_hash) {
        console.log("Wrench attack paid successfully")
        // Update cumulated fines in database
        console.log("Updating cumulated fines")
        res = await LNbits.api
          .request(
            'PUT',
            '/monopoly/api/v1/cards/update_cumulated_fines',
            this.game.player.wallets[0].inkey,
            {
              game_id: this.game.marketData.id,
              fine: this.game.wrenchAttackAmountSats
            }
          )
        if(res.data) {
          console.log("Cumulated fines updated successfully")
        } else {
          LNbits.utils.notifyApiError(res.error)
        }
        this.closeWrenchAttackDialog()
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
    },
    closeWrenchAttackDialog: function() {
      this.game.showWrenchAttackDialog = false
    },
    showNotYourTurnPopUp: function() {
      this.game.showNotYourTurnPopUp = true
    },
    closeNotYourTurnPopUp: function() {
      this.game.showNotYourTurnPopUp = false
    },
    showAlreadyClaimedStartBonusPopUp: function() {
      this.game.showAlreadyClaimedStartBonusPopUp = true
    },
    closeAlreadyClaimedStartBonusPopUp: function() {
      this.game.showAlreadyClaimedStartBonusPopUp = false
    },
    showUpgradeMinersPayment: function(property) {
      /*
      if(this.game.created) {
        this.game.gameCreatorPaymentToMarket = true
      }
      */
      this.game.showPropertyUpgradeDialog = true
      this.game.propertyUpgrade.property = property

      this.game.propertyUpgrade.price = property.miningCapacity < 4
        ? property.oneKwPrice
        : property.tenKwPrice

      this.game.showPropertyDialog = false;

      // this.showCamera()
    },
    showPropertyPurchasePayment: function(property) {
      /*
      if(this.game.created && !property.owner) {
        this.game.gameCreatorPaymentToMarket = true
      }
      */
      this.game.showPropertyPurchaseDialog = true
      this.game.propertyPurchase.property = property
      // this.showCamera()
    },
    payFine: async function(card) {
      if(card.fineType && card.fineType === "custom") {
        this.game.fineAmountSats = Math.floor(card.fineMultiplier * game.customFineMultiplier)
      } else if(card.fineType && card.fineType === "pct_balance") {
        this.game.fineAmountSats = Math.floor(card.fineMultiplier * game.userBalance)
      } else if (card.fineType && card.fineType === "pct_most_recent_tx") {
        this.game.fineAmountSats = Math.floor(card.fineMultiplier * 100) // Implement once tx history is implemented
      }
      //Get lnurl pay data
      let lnurlData = await decodeLNURL(this.game.lnurlPayLink, this.game.player.wallets[0])
      // Pay fine
      console.log("Paying fine...")
      let res = await LNbits.api.payLnurl(
        this.game.player.wallets[0],
        lnurlData.callback,
        lnurlData.description_hash,
        this.game.fineAmountSats * 1000, // mSats
        'Bitcoin Monopoly: fine',
        ''
        )
      if(res.data && res.data.payment_hash) {
        console.log("Fine paid successfully")
        // Update cumulated fines in database
        console.log("Updating cumulated fines")
        res = await LNbits.api
          .request(
            'PUT',
            '/monopoly/api/v1/cards/update_cumulated_fines',
            this.game.player.wallets[0].inkey,
            {
              game_id: this.game.marketData.id,
              fine: this.game.fineAmountSats
            }
          )
        if(res.data) {
          console.log("Cumulated fines updated successfully")
        } else {
          LNbits.utils.notifyApiError(res.error)
        }
        this.closePayFineDialog()
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
    },
    closePayFineDialog: function () {
      this.game.showLightningCard = false;
      this.game.lightningCardToShow = null;
      this.game.showProtocolCard = false;
      this.game.protocolCardToShow = null;
      this.game.fineAmountSats = 0;
      this.game.customFineMultiplier = 0;
      this.game.rewardAmountSats = 0;
      this.game.customRewardMultiplier = 0;
    },
    claimReward: async function(card) {
      if(card.rewardType && card.rewardType === "custom") {
        this.game.rewardAmountSats = Math.floor(card.rewardMultiplier * game.customRewardMultiplier)
      } else if(card.rewardType && card.rewardType === "fixed") {
        this.game.rewardAmountSats = Math.floor(card.rewardAmount)
      } else if (card.rewardType && card.rewardType === "pct_total_liquidity") {
        this.game.rewardAmountSats = Math.floor(card.rewardMultiplier * game.initialFunding)
      }
      let lnurlData = await decodeLNURL(this.game.rewardVoucher, this.game.player.wallets[0])
      // Claim reward
      console.log("Claiming reward...")
      await withdrawFromLNURL(lnurlData, this.game, this.game.player.wallets[0], this.game.rewardAmountSats, 'reward')
      console.log("Reward claimed successfully")
      this.closeClaimRewardDialog()
    },
    closeClaimRewardDialog: function () {
      this.game.showLightningCard = false;
      this.game.lightningCardToShow = null;
      this.game.showProtocolCard = false;
      this.game.protocolCardToShow = null;
      this.game.fineAmountMSats = 0;
      this.game.customFineMultiplier = 0;
      this.game.fineAmountSats = 0;
      this.game.customFineMultiplier = 0;
      this.game.rewardAmountSats = 0;
      this.game.customRewardMultiplier = 0;
    },
    showFreeBitcoinClaimDialog: async function () {
      this.game.cumulatedFines = await this.getCumulatedFines();
      this.game.showFreeBitcoinClaimDialog = true;
    },
    closeFreeBitcoinClaimDialog: function () {
      this.game.showFreeBitcoinClaimDialog = false;
    },
    showStartClaimDialog: function () {
      if(this.game.firstStartClaimThisTurn && this.game.firstStartClaimThisTurn !== 'false') {
        this.game.showStartClaimDialog = true;
      } else {
        this.showAlreadyClaimedStartBonusPopUp()
      }
    },
    closeStartClaimDialog: function () {
      this.game.showStartClaimDialog = false;
    },
    getCumulatedFines: async function () {
      let res = await LNbits.api
        .request(
          'GET',
          '/monopoly/api/v1/cumulated_fines?game_id=' + this.game.marketData.id,
          this.game.player.wallets[0].inkey,
        )
      if(res.data) {
        console.log(res.data)
        return res.data.cumulated_fines;
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
    },
    claimCumulatedFines: async function () {
      // Claim cumulated fines from the free market
      let lnurlData = await decodeLNURL(this.game.rewardVoucher, this.game.player.wallets[0])
      // Claim reward
      console.log("Claiming free sats...")
      await withdrawFromLNURL(lnurlData, this.game, this.game.player.wallets[0], this.game.cumulatedFines, 'free bitcoin')
      console.log("Free sats claimed successfully")
      // Reset cumulated_fines to 0 in database
      console.log("Resetting cumulated fines")
      let res = await LNbits.api
        .request(
          'PUT',
          '/monopoly/api/v1/cards/reset_cumulated_fines',
          this.game.player.wallets[0].inkey,
          {
            game_id: this.game.marketData.id,
          }
        )
      if(res.data) {
        console.log("Cumulated fines reset successfully")
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
      this.game.cumulatedFines = 0
      this.game.showFreeBitcoinClaimDialog = false;
    },
    claimStartAmount: async function () {
      let lnurlData = await decodeLNURL(this.game.rewardVoucher, this.game.player.wallets[0])
      // Claim reward
      console.log("Claiming start bonus...")
      await withdrawFromLNURL(lnurlData, this.game, this.game.player.wallets[0], this.game.startClaimAmount, 'start bonus')
      console.log("Start bonus claimed successfully")
      this.game.firstStartClaimThisTurn = false;
      saveGameData(this.game, 'firstStartClaimThisTurn', this.game.firstStartClaimThisTurn)
      this.game.showStartClaimDialog = false;
    },
    getLowestBalancePlayerName: function () {
      let lowestBalance = this.game.initialFunding + 1
      let lowestBalancePlayerName = ""
      Object.keys(this.game.players).forEach((player_wallet_id) => {
        if(this.game.players[player_wallet_id].player_balance < lowestBalance) {
          lowestBalance = this.game.players[player_wallet_id].player_balance
          lowestBalancePlayerName = this.game.players[player_wallet_id].player_wallet_name
        }
      })
      if(lowestBalancePlayerName == this.game.players[this.game.player.wallets[0].id].player_wallet_name) {
        lowestBalancePlayerName = "yourself"
      }
      return lowestBalancePlayerName
    },
    showCamera: function () {
      this.camera.show = true
    },
    showFreeMarketCamera: function () {
      this.freeMarketCamera = true
      this.camera.show = true
    },
    hasCamera: function () {
      navigator.permissions.query({name: 'camera'}).then(res => {
        return res.state == 'granted'
      })
    },
    pasteData: async function () {
      let onBehalfOfFreeMarket = !!this.freeMarketCamera; // Must assign before closing camera
      this.closeCamera()
      let data = await navigator.clipboard.readText()
      this.parseQRData(data, onBehalfOfFreeMarket)
    },
    decodeQR: function (res) {
      let onBehalfOfFreeMarket = !!this.freeMarketCamera; // Must assign before closing camera
      this.closeCamera()
      this.camera.data = res
      console.log(this.camera.data)
      if(this.camera.data) {
        this.parseQRData(this.camera.data, onBehalfOfFreeMarket)
      }
    },
    parseQRData: async function (QRData, onBehalfOfFreeMarket = false) {
      // Regular lightning invoice case
      if(QRData.slice(0, 2) == "ln") {
        const invoice = decodeInvoice(QRData);
        console.log(invoice)
        console.log(invoice.sat)
        this.game.invoiceAmount = invoice.sat.toString()
        this.game.invoice = QRData
        if(onBehalfOfFreeMarket) {
          this.game.showPayInvoiceOnBehalfOfFreeMarketDialog = true
        } else  {
          this.game.showPayInvoiceDialog = true
        }
      } else  {

        console.log(QRData)

        switch(QRData.slice(0,1)) {
          case "I": // Player invoice
            this.game.invoice = QRData
            this.game.invoiceRecipientIndex = QRData.slice(1,2)
            this.game.invoiceAmount = QRData.slice(2)
            // Get invoice recipient's name and wallet _id
            if(this.game.invoiceRecipientIndex === "0") {
              this.game.invoiceRecipientName = "the free market"
            } else {
              Object.keys(this.game.players).forEach((player_wallet_id) => {
                if(this.game.players[player_wallet_id].player_index === this.game.invoiceRecipientIndex) {
                  this.game.invoiceRecipientWalletId = player_wallet_id
                  this.game.invoiceRecipientName = this.game.players[player_wallet_id].player_wallet_name
                }
              })
            }
            if(onBehalfOfFreeMarket) {
              this.game.showPayInvoiceOnBehalfOfFreeMarketDialog = true
            } else  {
              this.game.showPayInvoiceDialog = true
            }
            break

          case "P": // Property card
            if(onBehalfOfFreeMarket) {
              throw("Invalid data type for free market")
            }
            if(QRData.slice(1,7) == "00ff00") { // Fix for wrench attacks (TO DO: use dedicated QR codes W1 and W2)
              if(this.game.playerTurn === this.game.player.index) {
                this.showWrenchAttackDialog(QRData.slice(7,8))
              } else {
                this.showNotYourTurnPopUp()
              }
            } else {
              this.closePropertyDialog()
              this.showPropertyDetails(properties[QRData.slice(1,7)][QRData.slice(7,8)])
            }
            break

          case "L": // Lightning card
            if(onBehalfOfFreeMarket) {
              throw("Invalid data type for free market")
            }
            if(this.game.playerTurn === this.game.player.index) {
              this.showLightningCard()
            } else {
              this.showNotYourTurnPopUp()
            }
            break

          case "B": // Protocol card
            if(onBehalfOfFreeMarket) {
              throw("Invalid data type for free market")
            }
            if(this.game.playerTurn === this.game.player.index) {
              this.showProtocolCard()
            } else {
              this.showNotYourTurnPopUp()
            }
            break
          case "S": // Property sale
            if(onBehalfOfFreeMarket) {
              throw("Invalid data type for free market")
            }
            this.closePropertyDialog()
            // const saleInvoice = decodeInvoice(data.invoice);
            this.game.showPropertyPurchaseDialog = true
            this.game.propertyPurchase.property = properties[QRData.slice(1,7)][QRData.slice(7,8)]
            this.game.propertyPurchase.property.price = QRData.slice(8)
            break

          case "N": // Network fee
            if(onBehalfOfFreeMarket) {
              throw("Invalid data type for free market")
            }
            this.closePropertyDialog()
            this.game.networkFeeInvoice.property = properties[QRData.slice(1,7)][QRData.slice(7,8)]
            this.game.networkFeeInvoice.invoiceAmount = QRData.slice(8)
            this.game.showNetworkFeePaymentDialog = true
            break

          case "F": // Free Bitcoin
            if(onBehalfOfFreeMarket) {
              throw("Invalid data type for free market")
            }
            if(this.game.playerTurn === this.game.player.index) {
              this.showFreeBitcoinClaimDialog()
            } else {
              this.showNotYourTurnPopUp()
            }
            break

          case "T": // Start
            if(onBehalfOfFreeMarket) {
              throw("Invalid data type for free market")
            }
            if(this.game.playerTurn === this.game.player.index) {
              this.showStartClaimDialog()
            } else {
              this.showNotYourTurnPopUp()
            }
            break

          default:
            console.log("Invalid data type")
            break
        }
      }
    },

    closeQRDialog: function () {
      this.qrCodeDialog.show = false
    },
  }
})
