import { properties } from './data/properties.js'
import {
  technology_cards,
  black_swan_cards
} from './data/cards.js'
import {
  newGame,
  cameraData,
  playerNames,
} from './data/data.js'
import { reactiveStyles } from '../css/styles.js'
import {
  paintOutline,
} from './helpers/camera.js'
import {
  decodeInvoice,
  withdrawFromLNURL,
  createPlayerPayLNURL
} from './helpers/utils.js'
import {
  onGameFunded,
} from './calls/database.js'
import {
  loadGame,
  initGameData,
} from './helpers/init.js'
import {
  saveGameRecord,
  loadGameDataFromLocalStorage,
  saveGameData,
  fetchGameRecords
} from './helpers/storage.js'
import {
  deleteInviteVoucher
} from './calls/api.js'
import {
  dragOptions,
  onMove,
  onDragged,
  onUpdatePropertiesCarouselSlide
} from './helpers/animations.js'
import {
  playBlackSwanCardSound,
  playBoughtMinerSound,
  playBoughtPropertySound,
  playDevelopmentCardSound,
  playPlayerSentPaymentToFreeMarketSound,
  playStartGameSound,
  playTaxationIsTheftSound
} from './helpers/audio.js'
import {
  checkWalletsBalances,
  checkPlayers,
  checkPlayerTurn,
  checkPlayersBalances,
  checkFundingInvoicePaid,
  checkPaymentsToPlayer,
} from './calls/intervals.js'
import { decodeLNURL } from './helpers/utils.js'

Vue.component(VueQrcode.name, VueQrcode)
Vue.use(VueQrcodeReader)

new Vue({
  el: '#vue',
  mixins: [windowMixin],
  mounted(){
    this.loadGame();
  },
  data: function() {
    return {
      loading: true,
      gameRecords: {},
      gameRecordsData: {},
      game: newGame,
      camera: cameraData,
      qrCodeDialog: {
        data: null,
        show: false
      },
      fundingTab: 'paylnurl',
      // data for draggable cards
      enabled: true,
      isDragging: false,
      delayedDragging: false,
    }
  },
  computed: {
    // Pass Vue components props here
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
    loadGame: async function() {
      const savedGameRecords = fetchGameRecords()
      this.gameRecords = savedGameRecords.gameRecords
      this.gameRecordsData = savedGameRecords.gameRecordsData
      this.game = await loadGame(savedGameRecords, this.$children[0].$children[3].$children[0].user.wallets)
      // Open camera if specified
      let camera = cameraData;
      camera.deviceId = this.game.cameraDeviceId;
      camera.trackFunction = paintOutline;
      if(window.open_camera === "true") {
        camera.show = true
      }
      this.camera = camera;
      this.loading = false;
    },
    // Methods for QR code scanning
    onInitCamera: async function() {
      // Start closeTimeout after which camera will be closed unless a QR code is detected
      /*
      this.camera.closeTimeout = setTimeout(() => {
        this.closeCamera()
        this.camera.data = null;
      }, 10000)
      */
      // Select video device (see: https://oberhofer.co/mediastreamtrack-and-its-capabilities/)
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.camera.candidateDevices = [];
      devices.forEach((device) => {
        if(device.kind === "videoinput") {
          this.camera.candidateDevices.push(device)
        }
      })
      if(this.game.cameraDeviceId) {
        // If deviceId is already known, select same device
        await this.selectCameraDevice(this.game.cameraDeviceId, null, true);
      } else {
        // Else, look through candidate devices
        if(this.camera.candidateDevices.length) {
          this.camera.deviceIndex = this.camera.candidateDevices.length - 1
          await this.selectCameraDevice(null, this.camera.deviceIndex, true);
        } else{
          this.camera.error = "Error: no camera found on device"
          console.error(this.camera.error)
        }
      }
    },
    selectCameraDevice: async function(deviceId, deviceIndex, retry = true) {
      this.camera.error = null;
      // Select last video device (usually camera with focus)
      try {
        if(deviceId) {
          this.camera.deviceId = deviceId;
          for(let i = 0; i < this.camera.candidateDevices.length; i++) {
            if(this.camera.candidateDevices[i].deviceId === deviceId) {
              this.camera.deviceIndex = i;
            }
          }
        } else if(deviceIndex >= 0) {
          this.camera.deviceIndex = deviceIndex;
          this.camera.deviceId = this.camera.candidateDevices[this.camera.deviceIndex].deviceId
        } else  {
          this.camera.error = "Error: tried all candidate camera devices"
          console.error(this.camera.error)
        }
        // Try selected device
        this.camera.constraints = {
          "video":  {
            "aspectRatio": 1,
            "frameRate": { "ideal": 4, "max": 12 },
            "facingMode": { "ideal":'environment' },
            "deviceId": { "exact": this.camera.deviceId }
          }
        }
        const video = document.querySelector("video");
        this.camera.stream = await navigator.mediaDevices.getUserMedia(this.camera.constraints);
        video.srcObject = this.camera.stream;
        // Wait for device to load
        video.addEventListener('loadedmetadata', (event) => {
          this.camera.capabilities = this.camera.stream.getVideoTracks()[0].getCapabilities();
          // Apply focusMode constraint if possible
          if(this.camera.capabilities.focusMode) {
            let continuousFocusAvailable = false;
            this.camera.capabilities.focusMode.forEach((focusMode) => {
              if (focusMode === "continuous") {
                continuousFocusAvailable = true;
              }
            })
            if(continuousFocusAvailable) {
              console.log("applying focus mode")
              this.camera.stream.getVideoTracks()[0].applyConstraints({
                "focusMode": "continuous"
              })
            }
          }
        });
        // If no error occured, save deviceId in local storage
        this.game.cameraDeviceId = this.camera.deviceId;
        saveGameData(this.game, 'cameraDeviceId', this.game.cameraDeviceId)
      } catch(err) {
        console.error(err)
        this.camera.error = err
        if(retry) {
          await this.selectCameraDevice(null,this.camera.deviceIndex - 1, true)
        }
      }
    },
    switchCameraDevice: async function(retry ) {
      this.camera.enableSwitchCameraButton = false
      console.log("Switching camera device")
      if(this.camera.deviceIndex > 0) {
        await this.selectCameraDevice(null,this.camera.deviceIndex - 1 , false)
      } else  {
        await this.selectCameraDevice(null,this.camera.candidateDevices.length - 1 , false)
      }
      this.camera.enableSwitchCameraButton = true
    },
    reloadCamera: async function(retry ) {
      console.log("Reloading camera")
      this.closeCamera()
      this.reloadCurrentGame(this.game.id, true)
    },
    closeCamera: function() {
      this.camera.show = false;
      this.camera.scanEnabled = false;
      this.camera.firstQRDetected = false;
      // Clear closeCamera timeout
      // clearTimeout(this.camera.closeTimeout)
      // Stop camera
      if(this.camera.stream) {
        let tracks = this.camera.stream.getTracks()
        if(tracks && tracks.length) {
          tracks.forEach((track) => {
            track.enabled = false;
            track.stop();
          })
        }
      }
      // Reset camera data
      this.camera = cameraData;
      if(window.open_camera === "true") {
        window.open_camera = null
        if(this.game.freeMarketWallet && this.game.freeMarketWallet.id) {
          window.history.pushState({}, document.title, "/monopoly/game?usr=" + this.game.player.id + "&wal=" + this.game.freeMarketWallet.id);
        } else if(this.game.player.wallet & this.game.player.wallet.id) {
          window.history.pushState({}, document.title, "/monopoly/game?usr=" + this.game.player.id + "&wal=" + this.game.player.wallet.id);
        }
      }
    },
    onError: function(err) {
      this.closeCamera()
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
    onUpdatePropertiesCarouselSlide: function(newSlide, oldSlide) {
      this.game.propertiesCarouselSlide = onUpdatePropertiesCarouselSlide(this.game, newSlide, oldSlide)
      saveGameData(this.game, 'propertiesCarouselSlide', this.game.propertiesCarouselSlide)
    },
    reloadCurrentGame: async function (gameId, openCamera = false) {
      console.log("Loading saved game: " + gameId);
      const savedGameRecords = fetchGameRecords()
      this.gameRecords = savedGameRecords.gameRecords
      this.gameRecordsData = savedGameRecords.gameRecordsData
      const game = loadGameDataFromLocalStorage(this.gameRecords[window.user.id][window.wal]);
      let href = ""
      if(this.game.freeMarketWallet && this.game.freeMarketWallet.id) {
        href = "https://" + window.location.hostname + "/monopoly/game?usr=" + game.player.id + "&wal=" + game.freeMarketWallet.id;
      } else if(this.game.player.wallet && this.game.player.wallet.id) {
        href = "https://" + window.location.hostname + "/monopoly/game?usr=" + game.player.id + "&wal=" + game.player.wallet.id;
      }
      if(openCamera) {
        href += "&open_camera=true"
      }
      // Redirect to game.html
      window.location.href = href
    },
    // Logic to create a new game and a dedicated wallet for game creator (called from index_old.html)
    createGame: async function () {
      // Register game in database
      let res = await LNbits.api
        .request(
          'POST',
          '/monopoly/api/v1/game',
          this.g.user.wallets[0].adminkey, // Pass game creator's pre-existing wallet's admin key as API key
          {
            admin_user_id: this.g.user.id,  // Pass game creator's user_id
            max_players_count: this.game.maxPlayersCount,
            available_player_names: playerNames,
          }
        )
      if(res.data) {
        console.log("Monopoly: new game registered successfully")
        console.log(res.data)
        this.game.created = true
        this.game.id = res.data.game_id
        this.game.fundingStatus = 'awaiting'
        this.game.timestamp = Date.now()
        // Game creator's player_id
        this.game.player.id = this.g.user.id;
        // Create free market wallet and dedicated player wallet for game creator
        await this.createFreeMarketWallet();
        // Start checking free market balance
        checkWalletsBalances(this.game, this.$children[0].$children[3].$children[0].user.wallets)
        // Create a static LNURL pay link to be used for funding the free market
        await this.createFreeMarketPayLNURL();
        // Save new game in local storage
        saveGameRecord(this.game)
        // Display the view for initial free market wallet funding
        this.game.showFundingView = true;
        // Save game data in local storage
        saveGameData(this.game, 'showFundingView', this.game.showFundingView)
        // Redirect to game.html
        window.location.href = "https://" + window.location.hostname + "/monopoly/game?usr=" + this.game.player.id + "&wal=" + this.game.freeMarketWallet.id;
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
    },
    // Logic to create free market wallet
    createFreeMarketWallet: async function () {
      // Create free market wallet belonging to game creator
      let res = await LNbits.api
        .request(
          'POST',
          '/monopoly/api/v1/wallet/free-market',
          this.g.user.wallets[0].adminkey,
          {
            game_id: this.game.id
          }
        )
      if(res.data) {
        console.log("Monopoly: free market wallet created successfully")
        console.log(res.data)
        this.game.freeMarketWallet = res.data // Save free market wallet
        // Update wallets list in left panel by accessing Vue component data
        this.$children[0].$children[3].$children[0].user.wallets.push({
          "adminkey": this.game.freeMarketWallet.adminkey,
          "fsat": 0,
          "live_fsat": 0,
          "msat": 0,
          "sat": 0,
          "id": this.game.freeMarketWallet.id,
          "inkey": this.game.freeMarketWallet.inkey,
          "name": "Free market",
          "url": "/wallet?usr=" + this.g.user.id + "&wal=" + this.game.freeMarketWallet.id
        })
        this.wallets = this.$children[0].$children[3].$children[0].user.wallets
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
    },
    // Logic to create a static LNURL pay link to be used for funding the free market
    createFreeMarketPayLNURL: async function () {
      const payLNURLData = {
        description: "Free market wallet pay link",
        min: 1,
        max: 1000000,
        comment_chars: 100,
        success_text: "Payment to free market confirmed"
      }
      // Create LNURL pay link
      let res = await LNbits.api
        .request(
          'POST', '/lnurlp/api/v1/links',
          this.game.freeMarketWallet.inkey,
          payLNURLData
        );
      if(res.data) {
        const payLinkId = res.data.id
        const payLink = res.data.lnurl
        // Register free market wallet pay link in database
        res = await LNbits.api
          .request(
            'PUT',
            '/monopoly/api/v1/wallet/pay-link',
            this.game.freeMarketWallet.inkey,
            {
              game_id: this.game.id,
              wallet_id: this.game.freeMarketWallet.id,
              pay_link_id: payLinkId,
              pay_link: payLink
            }
          )
        if(res.data) {
          console.log("Monopoly: LNURL pay link created successfully")
          console.log(res.data)
          // Save lnurl pay link in local storage
          this.game.freeMarketWalletPayLinkId = payLinkId;
          this.game.freeMarketWalletPayLink = payLink;
          saveGameData(this.game, 'freeMarketWalletPayLinkId', this.game.freeMarketWalletPayLinkId)
          saveGameData(this.game, 'freeMarketWalletPayLink', this.game.freeMarketWalletPayLink)
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
          this.game.freeMarketWallet,
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
    // Called from game.html
    onGameFunded: async function () {
      // Create player wallet for game creator
      await this.createFirstPlayer()
      // Start checking player balance
      checkWalletsBalances(this.game, this.$children[0].$children[3].$children[0].user.wallets)
      // Check for payments to player wallet
      checkPaymentsToPlayer(this.game)
      // Create a static LNURL pay link to be used for sending sats to player
      await this.createPlayerPayLNURL();
      // Start checking players
      checkPlayers(this.game)
      // Start checking players balances
      checkPlayersBalances(this.game)

      onGameFunded(this.game)
    },
    // Logic to create player wallet for game creator
    createFirstPlayer: async function () {
      // Create player wallet
      let res = await LNbits.api
        .request(
          'POST',
          '/monopoly/api/v1/player',
          this.game.freeMarketWallet.adminkey,
          {
            game_id: this.game.id,
            user_id: this.g.user.id
          }
        )
      if(res.data) {
        console.log("Monopoly: First player created successfully")
        console.log(res.data)
        this.game.playersCount = 1;
        this.game.player.index = res.data.player_index
        this.game.player.name = res.data.name
        delete res.data.player_index
        delete res.data.name
        this.game.player.wallet = res.data
        // Update wallets list in left panel by accessing Vue component data
        this.$children[0].$children[3].$children[0].user.wallets.push({
          "adminkey": this.game.player.wallet.adminkey,
          "fsat": 0,
          "live_fsat": 0,
          "msat": 0,
          "sat": 0,
          "id": this.game.player.wallet.id,
          "inkey": this.game.player.wallet.inkey,
          "name": this.game.player.name,
          "url": "/wallet?usr=" + this.g.user.id + "&wal=" + this.game.player.wallet.id
        })
        saveGameData(this.game, 'player', this.game.player)
        saveGameData(this.game, 'playersCount', this.game.playersCount)
      }
    },
    // Logic to create a static LNURL pay link to be used for sending sats to player
    createPlayerPayLNURL: async function () {
      const playerPayLinkCreated = await createPlayerPayLNURL(this.game);
      if(playerPayLinkCreated) {
        this.game.playerPayLinkCreated = true; // Already saved in local storage
      } else {
        LNbits.utils.notifyApiError("Error creating player pay link")
      }
    },
    initializeCards: async function () {
      // Initialize Lightning and Protocol cards indexes
      const res = await LNbits.api
        .request(
          'POST',
          '/monopoly/api/v1/cards/initialize-cards',
          this.game.freeMarketWallet.adminkey,
          {
            game_id: this.game.id,
            technology_cards_max_index: Object.keys(technology_cards).length,
            black_swan_cards_max_index: Object.keys(black_swan_cards).length
          },
        )
      if(res.status === 201) {
        console.log("Monopoly: cards initialized successfully")
      }
    },
    // Logic to format an invite link to invite other players to the game
    formatInviteLink: async function () {
      // Get vouchers from database using the free market admin key
      let res = await LNbits.api
        .request(
          'GET',
          '/withdraw/api/v1/links/' + this.game.inviteVoucherId,
          this.game.freeMarketWallet.adminkey
        )
      if(res.data) {
        const inviteVoucher = res.data.lnurl;
        res = await LNbits.api
          .request(
            'GET',
            '/withdraw/api/v1/links/' + this.game.rewardVoucherId,
            this.game.freeMarketWallet.inkey
          )
        if(res.data) {
          const rewardVoucher = res.data.lnurl;
          // Invite and reward vouchers are passed in the invite URL and cannot be obtained by other means
          return "https://" + window.location.hostname +
            "/monopoly/api/v1/invite?game_id=" + this.game.id +
            "&invite_voucher=" + inviteVoucher +
            "&reward_voucher=" + rewardVoucher;
        } else {
          LNbits.utils.notifyApiError(res.error)
        }
      } else {
        LNbits.utils.notifyApiError(res.error)
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
          this.game.player.wallet,
          this.game.playerInvoice.invoiceAmount,
          this.game.playerInvoice.amount.toString() + 'sats payment to ' + this.game.player.name,
          'sat',
          null
        )
        if(res.data) {
          this.game.playerInvoice.paymentReq = res.data.payment_request
          this.game.playerInvoice.paymentHash = res.data.payment_hash
          // Save player invoice in local storage
          // Not necessary?
          // saveGameData(this.game, 'playerInvoice', this.game.playerInvoice)
          // Once invoice has been created and saved, start checking for payments

          // this.checkPlayerInvoicePaid(this.game)
          // Copy player invoice paymentReq to clipboard
          await navigator.clipboard.writeText(this.game.playerInvoice.paymentReq)
        } else {
          LNbits.utils.notifyApiError(res.error)
        }
      } else  {
        LNbits.utils.notifyApiError('Error: invalid game.playerInvoice.amount')
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
    // Logic to start the game (called from index_old.html)
    startGame: async function () {
      // Delete game voucher now that all players joined and claimed their sats
      await this.deleteInviteVoucher()
      // Stop checking for new players
      clearInterval(this.game.playersChecker)
      // Initialize Lightning and Protocol cards indexes
      await this.initializeCards()
      // Start game
      const res = await LNbits.api
        .request(
          'PUT',
          '/monopoly/api/v1/game/start',
          this.game.freeMarketWallet.adminkey,
          {
            game_id: this.game.id,
          }
        )
      if(res.status === 201) {
        // Start checking player turn
        checkPlayerTurn(this.game)
        // Start game
        this.game.started = true;
        playStartGameSound()
        // Save game status in local storage
        saveGameData(this.game, 'started', this.game.started)
        console.log("GAME STARTED")
        this.game = initGameData(this.game);
      }
    },
    nextPlayerTurn: async function () {
      if(!this.game.incrementingPlayerTurn) {
        this.game.incrementingPlayerTurn = true
        const res = await LNbits.api
          .request(
            'PUT',
            '/monopoly/api/v1/game/next_player_turn',
            this.game.player.wallet.inkey,
            {
              game_id: this.game.id,
              player_index: this.game.player.index
            }
          )
        if(res.data) {
          console.log("Incremented player turn: " + res.data)
          this.game.playerTurn = res.data
          this.game.incrementingPlayerTurn = false
        } else {
          LNbits.utils.notifyApiError(res.error)
          this.game.incrementingPlayerTurn = false
        }
      }
    },
    deleteInviteVoucher: async function () {
      await deleteInviteVoucher(this.game)
    },
    checkFundingInvoicePaid: function (invoiceReason = null) {
      checkFundingInvoicePaid(this.game, invoiceReason)
    },
    checkPlayerInvoicePaid: function (invoiceReason = null) {
      checkPlayerInvoicePaid(this.game, invoiceReason)
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
      console.log(this.game.propertyToShow)
    },
    getNetworkFeeInvoiceAmount: async function (property) {
      this.game.showSaleInvoiceDialog = false;
      this.erasePropertyInvoices()
      switch(property.color) {
        case("bfbfbf"):
          // Invoice network fee for mining pools
          let miningPoolsCount = this.game.properties[this.game.player.index]["bfbfbf"].length;
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
          let energyCompaniesCount = this.game.properties[this.game.player.index]["00FFFF"].length;
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
      this.game.propertyPurchaseData = null;
      this.game.propertySaleData = null;
      this.game.playerInvoiceAmount = null;
      this.game.customNetworkFeeInvoiceAmount = null;
      this.game.customNetworkFeeMultiplier = null;
      this.game.playerInvoice = newGame.playerInvoice;
      this.game.fundingInvoice.paymentReq = null;
      this.game.fundingInvoice = newGame.fundingInvoice;
      this.game.networkFeeInvoiceCreated = false;
      this.game.networkFeeInvoiceData = null;
      this.game.networkFeeInvoice = {};
      this.game.saleInvoiceCreated = false;
      this.game.upgradeInvoice = false;
      this.game.purchaseInvoiceCreated = false;
      this.game.upgradeInvoiceCreated = false;
      this.game.propertyUpgradeData = null;
    },
    payInvoice: async function() {
      if(this.game.invoice.slice(0, 2) == "ln") {
        // Pay invoice
        console.log(this.game.invoice)
        console.log("Paying invoice...")
        this.game.showPayInvoiceSpinner = true
        let res = await LNbits.api.payInvoice(this.game.player.wallet, this.game.invoice);
        if(res.data && res.data.payment_hash) {
          console.log("Invoice paid successfully")
          this.closePayInvoiceDialog()
          this.game.showPayInvoiceSpinner = false
        } else {
          this.game.showPayInvoiceSpinner = false
          LNbits.utils.notifyApiError(res.error)
        }
      } else {
        try {
          // Get invoice recipient's pay link
          let invoiceRecipientPayLink;
          if(this.game.invoiceRecipientIndex === "0") {
            invoiceRecipientPayLink = this.game.freeMarketWalletPayLink
          } else {
            let res = await LNbits.api
              .request(
                'GET',
                '/monopoly/api/v1/players/pay_link?game_id=' + this.game.id + '&pay_link_player_index=' + this.game.invoiceRecipientIndex,
                this.game.player.wallet.inkey
              )
            if(res.data) {
              invoiceRecipientPayLink = res.data.player_pay_link
            } else {
              LNbits.utils.notifyApiError(res.error)
            }
          }
          //Get lnurl pay data
          let lnurlData = await decodeLNURL(invoiceRecipientPayLink, this.game.player.wallet)
          // Pay invoice to invoice recipient's pay link
          console.log("Paying to invoice recipient's pay link...")
          let res = await LNbits.api.payLnurl(
            this.game.player.wallet,
            lnurlData.callback,
            lnurlData.description_hash,
            this.game.invoiceAmount * 1000, // mSats
            'Bitcoin Monopoly: player invoice',
            ''
          )
          if(res.data && res.data.payment_hash) {
            console.log("Player invoice was paid successfully")
            this.closePayInvoiceDialog()
            this.game.showPayInvoiceSpinner = false
          } else {
            this.game.showPayInvoiceSpinner = false
            LNbits.utils.notifyApiError(res.error)
          }
        } catch(err) {
          this.game.showPayInvoiceSpinner = false
          LNbits.utils.notifyApiError(err)
        }
      }
    },
    purchaseProperty: async function() {
      console.log("Purchasing property...")
      if(!this.game.purchasingProperty) {
        try {
          this.game.purchasingProperty = true; // Prevent purchasing multiple times
          this.game.showPayInvoiceSpinner = true
          // Check if property is already registered in database
          let res = await LNbits.api
            .request(
              'GET',
              '/monopoly/api/v1/property?game_id=' + this.game.id
              + '&color=' + this.game.propertyPurchase.property.color
              + '&property_id=' + this.game.propertyPurchase.property.id,
              this.game.player.wallet.inkey,
            )
          if(res.data) {
            console.log("Property already registered...")
            // Get property owner index
            let propertyOwnerIndex;
            Object.keys(this.game.properties).forEach((ownerIndex) => {
              if(this.game.properties[ownerIndex][this.game.propertyPurchase.property.color]) {
                this.game.properties[ownerIndex][this.game.propertyPurchase.property.color].forEach((property) => {
                  if(property.id ===  this.game.propertyPurchase.property.id) {
                    propertyOwnerIndex = property.player_index;
                  }
                });
              }
            });
            // Get property owner's pay link
            res = await LNbits.api
              .request(
                'GET',
                '/monopoly/api/v1/player_pay_link?game_id=' + this.game.id + '&pay_link_player_index=' + propertyOwnerIndex,
                this.game.player.wallet.inkey
              )
            if(res.data) {
              let propertyOwnerPayLink = res.data.pay_link
              //Get lnurl pay data
              let lnurlData = await decodeLNURL(propertyOwnerPayLink, this.game.player.wallet)
              // Pay property price to property owner's pay link
              console.log("Paying property purchase to property owner's pay link...")
              res = await LNbits.api.payLnurl(
                this.game.player.wallet,
                lnurlData.callback,
                lnurlData.description_hash,
                this.game.propertyPurchase.property.price * 1000, // mSats
                'Bitcoin Monopoly: property purchase',
                ''
              )
              if(res.data && res.data.payment_hash) {
                console.log("Property purchase was paid successfully")
                console.log("Updating property ownership")
                await this.transferPropertyOwnership(this.game.propertyPurchase.property, this.game.player.index)
                // Play audio
                playBoughtPropertySound()
                this.closePropertyPurchaseDialog()
                this.game.showPayInvoiceSpinner = false
                this.game.purchasingProperty = false;
              } else {
                this.game.showPayInvoiceSpinner = false
                this.game.purchasingProperty = false
                LNbits.utils.notifyApiError(res.error)
              }
            } else {
              this.game.showPayInvoiceSpinner = false
              this.game.purchasingProperty = false
              LNbits.utils.notifyApiError(res.error)
            }
          } else {
            console.log("Property is not yet registered...")
            //Get lnurl pay data
            let lnurlData = await decodeLNURL(this.game.freeMarketWalletPayLink, this.game.player.wallet)
            // Pay property purchase to free market pay link
            console.log("Paying property purchase to free market pay link...")
            res = await LNbits.api.payLnurl(
              this.game.player.wallet,
              lnurlData.callback,
              lnurlData.description_hash,
              this.game.propertyPurchase.property.price * 1000, // mSats
              'Bitcoin Monopoly: property purchase',
              ''
            )
            if(res.data && res.data.payment_hash) {
              console.log("Property purchase was paid successfully")
              console.log("Registering property")
              await this.registerProperty(this.game.propertyPurchase.property, this.game.player.index)
              // Play audio
              playBoughtPropertySound()
              this.closePropertyPurchaseDialog()
              this.game.showPayInvoiceSpinner = false
              this.game.purchasingProperty = false
            } else {
              this.game.showPayInvoiceSpinner = false
              this.game.purchasingProperty = false
              LNbits.utils.notifyApiError(res.error)
            }
          }
          // Switch carouselSlide value to property color to display newly purchased property
          this.game.propertiesCarouselSlide = this.game.propertyPurchase.property.color
          saveGameData(this.game, 'propertiesCarouselSlide', this.game.propertiesCarouselSlide)
        } catch(err) {
          this.game.showPayInvoiceSpinner = false
          this.game.purchasingProperty = false
          LNbits.utils.notifyApiError(err)
        }
      }
    },
    registerProperty: async function(property, buyerIndex) {
      let res = await LNbits.api
        .request(
          'POST',
          '/monopoly/api/v1/property',
          this.game.player.wallet.inkey,
          {
            game_id: this.game.id,
            property_id: property.id,
            color: property.color,
            player_index: buyerIndex,
            mining_capacity: 0,
            mining_income: 0
          }
        )
      if(res.status === 201) {
        console.log("Property registered successfully")
      }
    },
    transferPropertyOwnership: async function(property, buyerIndex) {
      let res = await LNbits.api
        .request(
          'PUT',
          '/monopoly/api/v1/transfer-property-ownership',
          this.game.player.wallet.inkey,
          {
            game_id: this.game.id,
            property_id: property.id,
            color: property.color,
            player_index: buyerIndex,
            mining_capacity: 0,
            mining_income: 0
          }
        )
      if(res.status === 201) {
        console.log("Property ownership transferred successfully")
      }
    },
    upgradeProperty: async function() {
      if(!this.game.upgradingProperty) {
        try {
          this.game.upgradingProperty = true // Prevent upgrading multiple times
          this.game.showPayInvoiceSpinner = true
          //Get lnurl pay data
          let lnurlData = await decodeLNURL(this.game.freeMarketWalletPayLink, this.game.player.wallet)
          console.log("Upgrading property...")
          // Pay property upgrade to free market pay link
          console.log("Paying property upgrade to free market pay link...")
          let res = await LNbits.api.payLnurl(
            this.game.player.wallet,
            lnurlData.callback,
            lnurlData.description_hash,
            this.game.propertyUpgrade.price * 1000, // mSats
            'Bitcoin Monopoly: property upgrade',
            ''
          )
          if(res.data && res.data.payment_hash) {
            console.log("Property upgrade was paid successfully")
            this.closePropertyUpgradeDialog()
            this.game.showPayInvoiceSpinner = false
            console.log("Updating property's mining capacity")
            await this.upgradePropertyMiningCapacity(this.game.propertyUpgrade.property)
            this.game.upgradingProperty = false
          } else {
            this.game.showPayInvoiceSpinner = false
            this.game.upgradingProperty = false
            LNbits.utils.notifyApiError(res.error)
          }
        } catch(err) {
          this.game.showPayInvoiceSpinner = false
          this.game.upgradingProperty = false
          LNbits.utils.notifyApiError(err)
        }
      }
    },
    upgradePropertyMiningCapacity: async function(property) {
      let res = await LNbits.api
        .request(
          'PUT',
          '/monopoly/api/v1/upgrade-property-miners',
          this.game.player.wallet.inkey,
          {
            game_id: this.game.id,
            player_index: this.game.player.index,
            color: property.color,
            property_id: property.id
          }
        )
      if(res.status === 201) {
        console.log("Property's mining capacity upgraded successfully")
        // Play audio
        playBoughtMinerSound()
      }
    },
    payNetworkFee: async function() {
      if(!this.game.payingNetworkFee) {
        console.log("Paying network fee...")
        this.game.payingNetworkFee = true // Prevent paying multiple times
        this.game.showPayInvoiceSpinner = true
        // Get property owner index
        let propertyOwnerIndex;
        Object.keys(this.game.properties).forEach((ownerIndex) => {
          if(this.game.properties[ownerIndex][this.game.networkFeeInvoice.property.color]) {
            this.game.properties[ownerIndex][this.game.networkFeeInvoice.property.color].forEach((property) => {
              if(property.id ===  this.game.networkFeeInvoice.property.id) {
                propertyOwnerIndex = property.player_index;
              }
            });
          }
        });
        // Get property owner's pay link
        let res = await LNbits.api
          .request(
            'GET',
            '/monopoly/api/v1/player_pay_link?game_id=' + this.game.id + '&pay_link_player_index=' + propertyOwnerIndex,
            this.game.player.wallet.inkey
          )
        if(res.data) {
          let propertyOwnerPayLink = res.data.pay_link
          //Get lnurl pay data
          let lnurlData = await decodeLNURL(propertyOwnerPayLink, this.game.player.wallet)
          // Pay network fee to property owner's pay link
          console.log("Paying network fee to property owner's pay link...")
          res = await LNbits.api.payLnurl(
            this.game.player.wallet,
            lnurlData.callback,
            lnurlData.description_hash,
            this.game.networkFeeInvoice.invoiceAmount * 1000, // mSats
            'Bitcoin Monopoly: network fee',
            ''
          )
          if(res.data && res.data.payment_hash) {
            console.log("Network fee was paid successfully")
            this.closeNetworkFeePaymentDialog()
            this.game.showPayInvoiceSpinner = false
            console.log("Updating property's cumulated mining income")
            await this.updatePropertyMiningIncome(this.game.networkFeeInvoice.property, this.game.networkFeeInvoice.invoiceAmount)
            this.game.payingNetworkFee = false
          } else {
            this.game.showPayInvoiceSpinner = false
            this.game.payingNetworkFee = false
            LNbits.utils.notifyApiError(res.error)
          }
        } else {
          this.game.showPayInvoiceSpinner = false
          this.game.payingNetworkFee = false
          LNbits.utils.notifyApiError(res.error)
        }
      }
    },
    updatePropertyMiningIncome: async function(property, amount) {
      let res = await LNbits.api
        .request(
          'PUT',
          '/monopoly/api/v1/update-property-income',
          this.game.player.wallet.inkey,
          {
            game_id: this.game.id,
            player_index: this.game.player.index,
            color: property.color,
            property_id: property.id,
            income_increment: amount
          }
        )
      if(res.status === 201) {
        console.log("Property's cumulated mining income updated successfully")
      }
    },
    showLightningCard: async function() {
      let res = await LNbits.api
        .request(
          'POST',
          '/monopoly/api/v1/cards/pick-card',
          this.game.player.wallet.inkey,
          {
            game_id: this.game.id,
            card_type: 'technology',
            player_index:  this.game.player.index
          }
        )
      console.log(res)
      if(res.data) {
        let cardIndex = res.data
        if(this.game.firstLightningCardThisTurn) {
          this.game.firstLightningCardThisTurn = false
          saveGameData(this.game, 'firstLightningCardThisTurn', this.game.firstLightningCardThisTurn)
        }
        console.log("Showing Lightning card at index " + cardIndex)
        console.log(technology_cards[cardIndex].imgPath)
        this.game.showLightningCard = true;
        this.game.lightningCardToShow = technology_cards[cardIndex];
        playDevelopmentCardSound()
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
    },
    showProtocolCard: async function() {
      let res = await LNbits.api
        .request(
          'POST',
          '/monopoly/api/v1/cards/pick-card',
          this.game.player.wallet.inkey,
          {
            game_id: this.game.id,
            card_type: 'black_swan',
            player_index:  this.game.player.index
          }
        )
      console.log(res)
      if(res.data) {
        let cardIndex = res.data
        if(this.game.firstProtocolCardThisTurn) {
          this.game.firstProtocolCardThisTurn = false
          saveGameData(this.game, 'firstProtocolCardThisTurn', this.game.firstProtocolCardThisTurn)
        }
        console.log("Showing Protocol card at index " + cardIndex)
        console.log(black_swan_cards[cardIndex].imgPath)
        this.game.showProtocolCard = true;
        this.game.protocolCardToShow = black_swan_cards[cardIndex];
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
    },
    showWrenchAttackDialog: function(wrenchAttackIndex) {
      this.game.wrenchAttackAmountSats = wrenchAttackIndex === "0"
        ? Math.max(200, 0.1 * this.game.playerBalance)
        : 75
        this.game.showWrenchAttackDialog = true
    },
    payWrenchAttack: async function() {
      this.game.showPayFineSpinner = true
      //Get lnurl pay data
      let lnurlData = await decodeLNURL(this.game.freeMarketWalletPayLink, this.game.player.wallet)
      // Pay wrench attack
      console.log("Paying wrench attack...")
      let res = await LNbits.api.payLnurl(
        this.game.player.wallet,
        lnurlData.callback,
        lnurlData.description_hash,
        this.game.wrenchAttackAmountSats * 1000, // mSats
        'Bitcoin Monopoly: wrench attack',
        ''
      )
      if(res.data && res.data.payment_hash) {
        console.log("Wrench attack paid successfully")
        playPlayerSentPaymentToFreeMarketSound()
        // Update cumulated fines in database
        console.log("Updating cumulated fines")
        res = await LNbits.api
          .request(
            'PUT',
            '/monopoly/api/v1/update_cumulated_fines',
            this.game.player.wallet.inkey,
            {
              game_id: this.game.id,
              player_index: this.game.player.index,
              fine: this.game.wrenchAttackAmountSats
            }
          )
        if(res.status === 201) {
          console.log("Cumulated fines updated successfully")
        } else {
          LNbits.utils.notifyApiError(res.error)
        }
        this.closeWrenchAttackDialog()
        this.game.showPayFineSpinner = false
      } else {
        this.game.showPayFineSpinner = false
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
      this.game.showPropertyUpgradeDialog = true
      this.game.propertyUpgrade.property = property

      this.game.propertyUpgrade.price = property.miningCapacity < 4
        ? property.oneKwPrice
        : property.tenKwPrice

      this.game.showPropertyDialog = false;
      },
    showPropertyPurchasePayment: function(property) {
      this.game.showPropertyPurchaseDialog = true
      this.game.propertyPurchase.property = property
    },
    payFine: async function(card) {
      this.game.showPayFineSpinner = true
      if(card.fineType && card.fineType === "custom") {
        this.game.fineAmountSats = Math.floor(card.fineMultiplier * this.game.customFineMultiplier)
      } else if(card.fineType && card.fineType === "pct_balance") {
        this.game.fineAmountSats = Math.floor(card.fineMultiplier * this.game.userBalance)
      } else if (card.fineType && card.fineType === "pct_most_recent_tx") {
        this.game.fineAmountSats = Math.floor(card.fineMultiplier * 100) // Implement once tx history is implemented
      }
      //Get lnurl pay data
      let lnurlData = await decodeLNURL(this.game.freeMarketWalletPayLink, this.game.player.wallet)
      // Pay fine
      console.log("Paying fine...")
      let res = await LNbits.api.payLnurl(
        this.game.player.wallet,
        lnurlData.callback,
        lnurlData.description_hash,
        this.game.fineAmountSats * 1000, // mSats
        'Bitcoin Monopoly: fine',
        ''
        )
      if(res.data && res.data.payment_hash) {
        console.log("Fine paid successfully")
        playPlayerSentPaymentToFreeMarketSound()
        // Update cumulated fines in database
        console.log("Updating cumulated fines")
        res = await LNbits.api
          .request(
            'PUT',
            '/monopoly/api/v1/update_cumulated_fines',
            this.game.player.wallet.inkey,
            {
              game_id: this.game.id,
              player_index: this.game.player.index,
              fine: this.game.fineAmountSats
            }
          )
        if(res.status === 201) {
          console.log("Cumulated fines updated successfully")
        } else {
          LNbits.utils.notifyApiError(res.error)
        }
        this.closePayFineDialog()
        this.game.showPayFineSpinner = false
      } else {
        this.game.showPayFineSpinner = false
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
        this.game.rewardAmountSats = Math.floor(card.rewardMultiplier * this.game.customRewardMultiplier)
      } else if(card.rewardType && card.rewardType === "fixed") {
        this.game.rewardAmountSats = Math.floor(card.rewardAmount)
      } else if (card.rewardType && card.rewardType === "pct_total_liquidity") {
        this.game.rewardAmountSats = Math.floor(card.rewardMultiplier * this.game.initialFunding)
      }
      let lnurlData = await decodeLNURL(this.game.rewardVoucher, this.game.player.wallet)
      // Claim reward
      console.log("Claiming reward...")
      await withdrawFromLNURL(lnurlData, this.game, this.game.player.wallet, this.game.rewardAmountSats, 'reward')
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
          '/monopoly/api/v1/cumulated_fines?game_id=' + this.game.id,
          this.game.player.wallet.inkey,
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
      let lnurlData = await decodeLNURL(this.game.rewardVoucher, this.game.player.wallet)
      // Claim reward
      console.log("Claiming free sats...")
      await withdrawFromLNURL(lnurlData, this.game, this.game.player.wallet, this.game.cumulatedFines, 'free bitcoin')
      console.log("Free sats claimed successfully")
      // Reset cumulated_fines to 0 in database
      console.log("Resetting cumulated fines")
      let res = await LNbits.api
        .request(
          'PUT',
          '/monopoly/api/v1/reset_cumulated_fines',
          this.game.player.wallet.inkey,
          {
            game_id: this.game.id,
            player_index: this.game.player.index
          }
        )
      if(res.status === 201) {
        console.log("Cumulated fines reset successfully")
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
      this.game.cumulatedFines = 0
      this.game.showFreeBitcoinClaimDialog = false;
    },
    claimStartAmount: async function () {
      let lnurlData = await decodeLNURL(this.game.rewardVoucher, this.game.player.wallet)
      // Claim reward
      console.log("Claiming start bonus...")
      await withdrawFromLNURL(lnurlData, this.game, this.game.player.wallet, this.game.startClaimAmount, 'start bonus')
      console.log("Start bonus claimed successfully")
      let res = await LNbits.api
        .request(
          'PUT',
          '/monopoly/api/v1/update-player-pow-provided',
          this.game.player.wallet.inkey,
          {
            game_id: this.game.id,
            player_index: this.game.player.index,
          }
        )
      if(res.status === 201) {
        console.log("Player POW provided updated successfully")
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
      this.game.firstStartClaimThisTurn = false;
      saveGameData(this.game, 'firstStartClaimThisTurn', this.game.firstStartClaimThisTurn)
      this.game.showStartClaimDialog = false;
    },
    getLowestBalancePlayerName: function () {
      let lowestBalance = this.game.initialFunding + 1
      let lowestBalancePlayerName = ""
      Object.keys(this.game.players).forEach((player_index) => {
        if(this.game.players[player_index].player_balance < lowestBalance) {
          lowestBalance = this.game.players[player_index].player_balance
          lowestBalancePlayerName = this.game.players[player_index].player_wallet_name
        }
      })
      if(lowestBalancePlayerName == this.game.players[this.game.player.wallet.id].player_wallet_name) {
        lowestBalancePlayerName = "yourself"
      }
      return lowestBalancePlayerName
    },
    showCamera: function () {
      this.camera.show = true
      if(window.open_camera !== "true") {
        window.open_camera = "true"
        if(this.game.freeMarketWallet && this.game.freeMarketWallet.id) {
          window.history.pushState({}, document.title, "/monopoly/game?usr=" + this.game.player.id + "&wal=" + this.game.freeMarketWallet.id + "&open_camera=true");
        } else if(this.game.player.wallet & this.game.player.wallet.id) {
          window.history.pushState({}, document.title, "/monopoly/game?usr=" + this.game.player.id + "&wal=" + this.game.player.wallet.id + "&open_camera=true");
        }
      }
    },
    hasCamera: function () {
      navigator.permissions.query({name: 'camera'}).then(res => {
        return res.state == 'granted'
      })
    },
    pasteData: async function () {
      this.closeCamera()
      let data = await navigator.clipboard.readText()
      this.parseQRData(data)
    },
    enableScan: function () {
      this.camera.scanEnabled = true
      if(this.camera.data && this.camera.data.content) {
        this.decodeQR()
      }
    },
    detectQR: async function (QRDataPromise) {
      this.camera.data = await QRDataPromise
      if(!this.camera.firstQRDetected) {
        this.camera.firstQRDetected = true
      }
      console.log(this.camera.data.content)
      if(this.camera.scanEnabled) {
        if(this.camera.data && this.camera.data.content) {
          if(this.camera.scanEnabled) {
            this.decodeQR()
          }
        }
      } else {
        // Reset closeCamera timeout
        /*
        clearTimeout(this.camera.closeTimeout)
        this.camera.closeTimeout = setTimeout(() => {
          this.closeCamera()
          this.camera.data = null;
        }, 10000)
        */
      }
    },
    decodeQR: function () {
      this.closeCamera()
      this.camera.scanEnabled = false
      let QRdata = this.camera.data.content
      this.camera.data = null
      this.parseQRData(QRdata)
    },
    parseQRData: async function (QRData) {
      // Regular lightning invoice case
      if(QRData.slice(0, 2) == "ln") {
        const invoice = decodeInvoice(QRData);
        console.log(invoice)
        console.log(invoice.sat)
        this.game.invoiceAmount = invoice.sat.toString()
        this.game.invoice = QRData
        this.game.showPayInvoiceDialog = true
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
              Object.keys(this.game.players).forEach((player_index) => {
                if(player_index === this.game.invoiceRecipientIndex) {
                  this.game.invoiceRecipientName = this.game.players[player_index].player_wallet_name
                }
              })
            }
            this.game.showPayInvoiceDialog = true
            break

          case "P": // Property card
            if(QRData.slice(1,7) == "00ff00") { // Fix for Taxation is theft (formerly wrench attacks) (TO DO: use dedicated QR codes T1 and T2)
              if(this.game.playerTurn === this.game.player.index) {
                playTaxationIsTheftSound()
                this.showWrenchAttackDialog(QRData.slice(7,8))
              } else {
                this.showNotYourTurnPopUp()
              }
            } else {
              this.closePropertyDialog()
              this.showPropertyDetails(properties[QRData.slice(1,7)][QRData.slice(7,8)])
            }
            break

          case "L": // Development card (formerly Lightning card)
            if(this.game.playerTurn === this.game.player.index) {
              this.showLightningCard()
            } else {
              this.showNotYourTurnPopUp()
            }
            break

          case "B": // Black swan card (formerly Protocol card)
            if(this.game.playerTurn === this.game.player.index) {
              playBlackSwanCardSound()
              this.showProtocolCard()
            } else {
              this.showNotYourTurnPopUp()
            }
            break

          case "S": // Property sale
            this.closePropertyDialog()
            // const saleInvoice = decodeInvoice(data.invoice);
            this.game.showPropertyPurchaseDialog = true
            this.game.propertyPurchase.property = properties[QRData.slice(1,7)][QRData.slice(7,8)]
            this.game.propertyPurchase.property.price = QRData.slice(8)
            break

          case "N": // Network fee
            this.closePropertyDialog()
            this.game.networkFeeInvoice.property = properties[QRData.slice(1,7)][QRData.slice(7,8)]
            this.game.networkFeeInvoice.invoiceAmount = QRData.slice(8)
            this.game.showNetworkFeePaymentDialog = true
            break

          case "F": // Free Bitcoin
            if(this.game.playerTurn === this.game.player.index) {
              this.showFreeBitcoinClaimDialog()
            } else {
              this.showNotYourTurnPopUp()
            }
            break

          case "T": // Start
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
