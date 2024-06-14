import { properties } from './data/properties.js'
import {
  technology_cards,
  black_swan_cards
} from './data/cards.js'
import {
  newGame,
  cameraData,
  playerNames,
  gameRecordsData
} from './data/data.js'
import { reactiveStyles } from '../css/styles.js'
import {
  paintOutline,
  paintCenterText,
  paintBoundingBox
} from './helpers/camera.js'
import {
  decodeInvoice,
  withdrawFromLNURL,
  createPlayerPayLNURL, updateGameProperties, repositionProperties, updatePropertiesCarouselSlide
} from './helpers/utils.js'
import {
  freeMarketWallet,
  playerWallet,
  inkey
} from './helpers/helpers.js'
import {
  getGamePlayerFromGameRecord, getGamePlayersFromUser,
  getGameRecordsFromDatabase,
  onGameFunded
} from './server/database.js'
import {
  loadGameFromURL,
} from './helpers/init.js'
import {
  storeGameRecord,
  storeGameData,
  getGameRecordsFromLocalStorage
} from './helpers/storage.js'
import {
  deleteInviteVoucher
} from './server/api.js'
import {
  dragOptions,
  onMove,
  onDragged,
  onUpdatePropertiesCarouselSlide
} from './helpers/animations.js'
import {
  playBlackSwanCardSound,
  playBoughtMinerSound,
  playPurchasedPropertySound,
  playDevelopmentCardSound,
  playPlayerSentPaymentToFreeMarketSound,
  playStartGameSound,
  playTaxationIsTheftSound, playNextPlayerTurnSound
} from './helpers/audio.js'
import { decodeLNURL } from './helpers/utils.js'
import { connectWebsocket, onMessage } from './server/websocket.js'

Vue.component(VueQrcode.name, VueQrcode)
Vue.use(VueQrcodeReader)

new Vue({
  el: '#vue',
  mixins: [windowMixin],
  data: function() {
    return {
      websocket: {
        url: "wss://dev.bitcoin-difficulty.io/play/ws/",
        ws: null
      },
      loading: true,
      gameRecords: {},
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
      refreshQRPreviewKey: 0
    }
  },
  mounted(){
    if(window.user.id && window.wal) {
      // Load game
      this.loadGameFromURL()
    } else if (window.user) {
      // Get saved games from database and local storage
      this.getSavedGames()
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
    connectWebsocket: async function() {
      // Establish websocket connection to get updates from server
      if(!this.websocket.ws && this.game.player.clientId) {
        this.websocket = await connectWebsocket(this.game)
        // Handle websocket events
        this.websocket.ws.onmessage = (event) => {
          this.game = onMessage(event, this.game, this.$children[0].$children[3].$children[0].user.wallets)
        }
      } else {
        console.error("Could not establish websocket connection with game server")
      }
    },
    loadGameFromURL: async function() {
      // Get saved games from database and local storage
      await this.getSavedGames()
      // Load saved game based on URL user id and wallet id
      this.game = await loadGameFromURL(this.gameRecords.rows)
      if(this.game.player.active) {
        // Open camera if specified
        let camera = cameraData;
        camera.deviceId = this.game.cameraDeviceId;
        camera.trackFunction = paintOutline;
        if(window.open_camera === "true") {
          camera.show = true
        }
        this.camera = camera;
        // Establish websocket connection to game server
        await this.connectWebsocket()
      }
      this.loading = false;
    },
    getSavedGames: async function () {
      let gamePlayers = await getGamePlayersFromUser()
      let gameRecordsRows = await getGameRecordsFromDatabase(gamePlayers)
      gameRecordsRows = getGameRecordsFromLocalStorage(gamePlayers, gameRecordsRows)
      this.gameRecords = gameRecordsData
      let gameRecordsMap = {}
      gameRecordsRows.forEach((gameRecord) => {
        if(!gameRecordsMap[gameRecord.gameId]) {
          gameRecordsMap[gameRecord.gameId] = {}
          gameRecordsMap[gameRecord.gameId][gameRecord.playerIndex] = gameRecord
        } else {
          // If another game record is already present with same player index
          if(gameRecordsMap[gameRecord.gameId][gameRecord.playerIndex]) {
            if(gameRecord.location === 'storage') {
              // Prioritize  'storage' game records over 'database' game records
              gameRecordsMap[gameRecord.gameId][gameRecord.playerIndex] = gameRecord
            }
          } else {
            gameRecordsMap[gameRecord.gameId][gameRecord.playerIndex] = gameRecord
          }
        }
      })
      Object.keys(gameRecordsMap).forEach((gameId) => {
          Object.keys(gameRecordsMap[gameId]).forEach((playerIndex) => {
            this.gameRecords.rows.push(gameRecordsMap[gameId][playerIndex])
          })
      })
      if(!(window.user.id && window.wal)) {
        this.loading = false
      }
    },
    loadSavedGame: async function(gameRecord) {
      let gamePlayer = await getGamePlayerFromGameRecord(gameRecord)
      // Redirect to game.html
      window.location.href = "https://" + window.location.hostname + "/play/game?usr=" +  window.user.id + "&wal=" +  gamePlayer.walletId;
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
      this.camera.constraints = {
        "video":  {
          "aspectRatio": 1,
          "frameRate": { "ideal": 4, "max": 12 },
          "facingMode": { "ideal":'environment' },
        }
      }
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
        }
        // Try selected device
        if(this.camera.deviceId) {
          this.camera.constraints["video"]["deviceId"] = this.camera.deviceId
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
        storeGameData(this.game, 'cameraDeviceId', this.game.cameraDeviceId)
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
      this.reloadGame(true)
    },
    closeCamera: function() {
      this.camera.show = false;
      // this.camera.scanEnabled = false;
      this.camera.QRDetected = false;
      this.game.QRPreview = null
      this.refreshQRPreviewKey += 1
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
        if(freeMarketWallet(this.game)) {
          window.history.pushState({}, document.title, "/play/game?usr=" + window.user.id + "&wal=" + freeMarketWallet(this.game).id,);
        } else if(playerWallet(this.game)) {
          window.history.pushState({}, document.title, "/play/game?usr=" + window.user.id + "&wal=" + playerWallet(this.game).id);
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
      storeGameData(this.game, 'propertiesCarouselSlide', this.game.propertiesCarouselSlide)
    },
    reloadGame: async function (openCamera = false) {
      let href = ""
      if(freeMarketWallet(this.game)) {
        href = "https://" + window.location.hostname + "/play/game?usr=" + window.user.id + "&wal=" + freeMarketWallet(this.game).id;
      } else if(playerWallet(this.game)) {
        href = "https://" + window.location.hostname + "/play/game?usr=" + window.user.id + "&wal=" + playerWallet(this.game).id;
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
          '/play/api/v1/game',
          this.g.user.wallets[0].adminkey, // Pass game creator's pre-existing wallet's admin key as API key
          {
            admin_user_id: this.g.user.id,  // Pass game creator's user_id
            max_players_count: this.game.maxPlayersCount,
            available_player_names: playerNames,
          }
        )
      if(res.data) {
        console.log("Bitcoin Difficulty: new game registered successfully")
        console.log(res.data)
        this.game.created = true
        this.game.id = res.data.game_id
        this.game.fundingStatus = 'awaiting'
        this.game.timestamp = Date.now()
        // Game creator's player_id
        // this.game.player.id = this.g.user.id;
        // Create free market wallet and dedicated player wallet for game creator
        await this.createFreeMarketWallet();
        // Start checking free market balance
        // checkWalletsBalances(this.game, this.$children[0].$children[3].$children[0].user.wallets)
        // Create a static LNURL pay link to be used for funding the free market
        await this.createFreeMarketPayLNURL();
        // Save new game in local storage
        storeGameRecord(this.game)
        // Display the view for initial free market wallet funding
        this.game.showFundingView = true;
        // Save game data in local storage
        storeGameData(this.game, 'showFundingView', this.game.showFundingView)
        // Redirect to game.html
        window.location.href = "https://" + window.location.hostname + "/play/game?usr=" + window.user.id + "&wal=" + freeMarketWallet(this.game).id;
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
          '/play/api/v1/wallet/free-market',
          this.g.user.wallets[0].adminkey,
          {
            game_id: this.game.id
          }
        )
      if(res.data) {
        console.log("Bitcoin Difficulty: free market wallet created successfully")
        this.game.player.clientId = res.data.client_id
        // Update wallets list in left panel by accessing Vue component data
        this.$children[0].$children[3].$children[0].user.wallets.push({
          "adminkey": res.data.adminkey,
          "fsat": 0,
          "live_fsat": 0,
          "msat": 0,
          "sat": 0,
          "id": res.data.id,
          "inkey":res.data.inkey,
          "name": "Free market",
          "url": "/wallet?usr=" + this.g.user.id + "&wal=" + res.data.id
        })
        window.user.wallets.push({
          "name": "Free market",
          "user": this.g.user.id,
          "id": res.data.id,
          "inkey":res.data.inkey,
          "adminkey": res.data.adminkey,
          "balance_msat": 0
        })
        this.game.freeMarketWallet = { index: window.user.wallets.length - 1 }
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
          inkey(this.game),
          payLNURLData
        );
      if(res.data) {
        const payLinkId = res.data.id
        const payLink = res.data.lnurl
        // Register free market wallet pay link in database
        res = await LNbits.api
          .request(
            'PUT',
            '/play/api/v1/wallet/pay-link',
            inkey(this.game),
            {
              game_id: this.game.id,
              wallet_id: freeMarketWallet(this.game).id,
              pay_link_id: payLinkId,
              pay_link: payLink
            }
          )
        if(res.data) {
          console.log("Bitcoin Difficulty: LNURL pay link created successfully")
          console.log(res.data)
          // Save lnurl pay link in local storage
          this.game.freeMarketWalletPayLinkId = payLinkId;
          this.game.freeMarketWalletPayLink = payLink;
          storeGameData(this.game, 'freeMarketWalletPayLinkId', this.game.freeMarketWalletPayLinkId)
          storeGameData(this.game, 'freeMarketWalletPayLink', this.game.freeMarketWalletPayLink)
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
          freeMarketWallet(this.game),
          this.game.fundingInvoice.data.amount,
          this.game.fundingInvoice.data.memo,
          this.game.fundingInvoice.unit,
          this.game.fundingInvoice.lnurl && this.game.fundingInvoice.lnurl.callback
        )
        if(res.data) {
          this.game.fundingInvoice.paymentReq = res.data.payment_request
          this.game.fundingInvoice.paymentHash = res.data.payment_hash
          // Save funding invoice in local storage
          storeGameData(this.game, 'fundingInvoice', this.game.fundingInvoice)
          // Once invoice has been created and saved, start checking for payments
          // this.checkFundingInvoicePaid(invoiceReason)

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
      // checkWalletsBalances(this.game, this.$children[0].$children[3].$children[0].user.wallets)
      // Check for payments to player wallet
      // checkPaymentsToPlayer(this.game)
      // Create a static LNURL pay link to be used for sending sats to player
      await createPlayerPayLNURL(this.game)
      // Start checking players
      // checkPlayers(this.game)
      // Start checking players balances
      // checkPlayersBalances(this.game)

      onGameFunded(this.game)
    },
    // Logic to create player wallet for game creator
    createFirstPlayer: async function () {
      // Create player wallet
      let res = await LNbits.api
        .request(
          'POST',
          '/play/api/v1/player',
          freeMarketWallet(this.game).adminkey,
          {
            game_id: this.game.id,
            user_id: this.g.user.id
          }
        )
      if(res.data) {
        console.log("Bitcoin Difficulty: First player created successfully")
        this.game.playersCount = 1;
        storeGameData(this.game, 'playersCount', this.game.playersCount)
        // Update game.players
        this.game.players[res.data.player_index] = {
          name: res.data.name,
          player_balance: 0
        }
        // Store game.players
        storeGameData(this.game, 'players', this.game.players)
        // Update game.playersData
        this.game.playersData.rows.push(
          {
            index: res.data.player_index,
            name: res.data.name,
            player_balance: 0
          }
        )
        // Store game.playersData
        storeGameData(this.game, 'playersData', this.game.playersData)
        // Update wallets list in left panel by accessing Vue component data
        this.$children[0].$children[3].$children[0].user.wallets.push({
          "adminkey": res.data.adminkey,
          "fsat": 0,
          "live_fsat": 0,
          "msat": 0,
          "sat": 0,
          "id": res.data.id,
          "inkey": res.data.inkey,
          "name": res.data.name,
          "url": "/wallet?usr=" + this.g.user.id + "&wal=" + res.data.id
        })
        window.user.wallets.push({
          "name": res.data.name,
          "user": this.g.user.id,
          "id": res.data.id,
          "inkey":res.data.inkey,
          "adminkey": res.data.adminkey,
          "balance_msat": 0
        })
        // Update game.player
        this.game.player.index = res.data.player_index
        this.game.player.name = res.data.name
        this.game.player.wallet = { index: window.user.wallets.length - 1 }
        // Store game.player
        storeGameData(this.game, 'player', this.game.player)
      }
    },
    showDeactivatePlayerDialog: function(player_index) {
      this.game.showDeactivatePlayerDialog = true;
      this.game.playerToDeactivateIndex = player_index
      this.game.playerToDeactivateName = this.game.players[this.game.playerToDeactivateIndex].name
    },
    closeDeactivatePlayerDialog: function(player_index) {
      this.game.showDeactivatePlayerSpinner = false
      this.game.showDeactivatePlayerDialog = false
      this.game.playerToDeactivateIndex = null
      this.game.playerToDeactivateName = null
    },
    deactivatePlayer: async function() {
      this.game.showDeactivatePlayerSpinner = true
      // Kick player out of the game
      const res = await LNbits.api
        .request(
          'POST',
          '/play/api/v1/players/deactivate-player',
          freeMarketWallet(this.game).adminkey,
          {
            game_id: this.game.id,
            player_index: this.game.playerToDeactivateIndex,
          },
        )
      if(res.status === 201) {
        console.log("Bitcoin Difficulty: player " + this.game.playerToDeactivateName + " deactivated successfully")
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
      this.game.showDeactivatePlayerSpinner = false
      this.game.showDeactivatePlayerDialog = false
      this.game.playerToDeactivateIndex = null
      this.game.playerToDeactivateName = null
    },
    initializeCards: async function () {
      // Initialize Lightning and Protocol cards indexes
      const res = await LNbits.api
        .request(
          'POST',
          '/play/api/v1/cards/initialize-cards',
          freeMarketWallet(this.game).adminkey,
          {
            game_id: this.game.id,
            technology_cards_max_index: Object.keys(technology_cards).length,
            black_swan_cards_max_index: Object.keys(black_swan_cards).length
          },
        )
      if(res.status === 201) {
        console.log("Bitcoin Difficulty: cards initialized successfully")
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
    },
    // Logic to format an invite link to invite other players to the game
    formatInviteLink: async function () {
      // Get vouchers from database using the free market admin key
      let res = await LNbits.api
        .request(
          'GET',
          '/withdraw/api/v1/links/' + this.game.inviteVoucherId,
          freeMarketWallet(this.game).adminkey,
        )
      if(res.data) {
        const inviteVoucher = res.data.lnurl;
        // Invite and reward vouchers are passed in the invite URL and cannot be obtained by other means
        return "https://" + window.location.hostname +
          "/play/api/v1/invite?game_id=" + this.game.id +
          "&invite_voucher=" + inviteVoucher
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
          playerWallet(this.game),
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
      // clearInterval(this.game.playersChecker)
      // Initialize Lightning and Protocol cards indexes
      await this.initializeCards()
      // Start game
      const res = await LNbits.api
        .request(
          'PUT',
          '/play/api/v1/start-game',
          freeMarketWallet(this.game).adminkey,
          {
            game_id: this.game.id,
          }
        )
      console.log(res)
      if(res.data) {
        // Start checking player turn
        // checkPlayerTurn(this.game)
        // Start game
        this.game.started = true;
        // Store game status
        storeGameData(this.game, 'started', this.game.started)
        // Update player turn
        this.game.playerTurn = res.data
        // Store game playerTurn
        storeGameData(this.game, 'playerTurn', this.game.playerTurn)
        // Play audio
        playStartGameSound()
        console.log("GAME STARTED")
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
    },
    nextPlayerTurn: async function () {
      if(!this.game.incrementingPlayerTurn) {
        this.game.incrementingPlayerTurn = true
        const res = await LNbits.api
          .request(
            'PUT',
            '/play/api/v1/game/next_player_turn',
            playerWallet(this.game).inkey,
            {
              game_id: this.game.id,
              player_index: this.game.player.index
            }
          )
        if(res.data) {
          console.log("Incremented player turn: " + res.data)
          this.game.playerTurn = res.data
          storeGameData(this.game, 'playerTurn', this.game.playerTurn)
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
    showPropertyDetails: function (propertyToShow) {
      Object.keys(this.game.players).forEach((key) => {
        let player_index = key
        if(
          this.game.properties[player_index] &&
          this.game.properties[player_index][propertyToShow.color] &&
          this.game.properties[player_index][propertyToShow.color][propertyToShow.property_id] &&
          this.game.properties[player_index][propertyToShow.color][propertyToShow.property_id].player_index === player_index
        ) {
          propertyToShow.player_index = player_index
          propertyToShow.player_name = this.game.players[player_index].name
          propertyToShow.mining_capacity = this.game.properties[player_index][propertyToShow.color][propertyToShow.property_id].mining_capacity
          propertyToShow.mining_income = this.game.properties[player_index][propertyToShow.color][propertyToShow.property_id].mining_income
        }
      })
      this.game.propertyToShow = propertyToShow

      console.log(this.game.propertyToShow)
      this.game.showPropertyDialog = true;
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
          switch(property.property_id) {
            case "0":
              this.game.customNetworkFeeMultiplier = 1;
              this.game.showNetworkFeeInvoiceDialog = true;
              break;
            case "1":
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
        qr: "N" + property.color + property.property_id + this.game.playerInvoiceAmount.toString(),
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
        qr: "S" + property.color + property.property_id + this.game.playerInvoiceAmount.toString(),
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
        let res = await LNbits.api.payInvoice(playerWallet(this.game), this.game.invoice);
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
                '/play/api/v1/players/pay_link?game_id=' + this.game.id + '&pay_link_player_index=' + this.game.invoiceRecipientIndex,
                inkey(this.game)
              )
            if(res.data) {
              invoiceRecipientPayLink = res.data.player_pay_link
            } else {
              LNbits.utils.notifyApiError(res.error)
            }
          }
          //Get lnurl pay data
          let lnurlData = await decodeLNURL(invoiceRecipientPayLink, playerWallet(this.game))
          // Pay invoice to invoice recipient's pay link
          console.log("Paying to invoice recipient's pay link...")
          let res = await LNbits.api.payLnurl(
            playerWallet(this.game),
            lnurlData.callback,
            lnurlData.description_hash,
            this.game.invoiceAmount * 1000, // mSats
            'Bitcoin Bitcoin Difficulty: player invoice',
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
              '/play/api/v1/property?game_id=' + this.game.id
              + '&color=' + this.game.propertyPurchase.property.color
              + '&property_id=' + this.game.propertyPurchase.property.property_id,
              inkey(this.game),
            )
          if(res.data) {
            this.game.propertyPurchase.property.player_index = res.data.player_index
            this.game.propertyPurchase.property.mining_capacity = res.data.mining_capacity
            this.game.propertyPurchase.property.mining_income = res.data.mining_income
            console.log("Property already registered...")
            // Get property owner's pay link
            res = await LNbits.api
              .request(
                'GET',
                '/play/api/v1/player_pay_link?game_id=' + this.game.id + '&pay_link_player_index=' + this.game.propertyPurchase.property.player_index,
                inkey(this.game)
              )
            if(res.data) {
              let propertyOwnerPayLink = res.data.pay_link
              //Get lnurl pay data
              let lnurlData = await decodeLNURL(propertyOwnerPayLink, playerWallet(this.game))
              // Pay property price to property owner's pay link
              console.log("Paying property purchase to property owner's pay link...")
              res = await LNbits.api.payLnurl(
                playerWallet(this.game),
                lnurlData.callback,
                lnurlData.description_hash,
                this.game.propertyPurchase.property.price * 1000, // mSats
                'Bitcoin Bitcoin Difficulty: property purchase',
                ''
              )
              if(res.data && res.data.payment_hash) {
                console.log("Property purchase was paid successfully")
                console.log("Updating property ownership")
                this.game.propertyPurchase.property.player_index = this.game.player.index
                await this.transferPropertyOwnership(this.game.propertyPurchase.property)
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
            this.game.propertyPurchase.property.mining_capacity = 0
            this.game.propertyPurchase.property.mining_income = 0
            //Get lnurl pay data
            let lnurlData = await decodeLNURL(this.game.freeMarketWalletPayLink, playerWallet(this.game))
            // Pay property purchase to free market pay link
            console.log("Paying property purchase to free market pay link...")
            res = await LNbits.api.payLnurl(
              playerWallet(this.game),
              lnurlData.callback,
              lnurlData.description_hash,
              this.game.propertyPurchase.property.price * 1000, // mSats
              'Bitcoin Bitcoin Difficulty: property purchase',
              ''
            )
            if(res.data && res.data.payment_hash) {
              console.log("Property purchase was paid successfully")
              console.log("Registering property")
              this.game.propertyPurchase.property.player_index = this.game.player.index
              await this.registerProperty(this.game.propertyPurchase.property)
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
          storeGameData(this.game, 'propertiesCarouselSlide', this.game.propertiesCarouselSlide)
        } catch(err) {
          this.game.showPayInvoiceSpinner = false
          this.game.purchasingProperty = false
          LNbits.utils.notifyApiError(err)
        }
      }
    },
    registerProperty: async function(property) {
      let res = await LNbits.api
        .request(
          'POST',
          '/play/api/v1/property',
          playerWallet(this.game).inkey,
          {
            game_id: this.game.id,
            property_id: property.property_id,
            color: property.color,
            player_index: property.player_index
          }
        )
      if(res.status === 201) {
        console.log("Property registered successfully")
        this.game = updateGameProperties(this.game, property)
        this.game = repositionProperties(this.game)
        this.game = updatePropertiesCarouselSlide(this.game)
        // Store game data
        storeGameData(this.game, 'properties', this.game.properties)
        storeGameData(this.game, 'propertiesCount', this.game.propertiesCount)
        // Play audio
        playPurchasedPropertySound()
        console.log(this.game.properties)
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
    },
    transferPropertyOwnership: async function(property) {
      let res = await LNbits.api
        .request(
          'PUT',
          '/play/api/v1/transfer-property-ownership',
          playerWallet(this.game).inkey,
          {
            game_id: this.game.id,
            property_id: property.property_id,
            color: property.color,
            player_index: property.player_index
          }
        )
      if(res.status === 201) {
        console.log("Property ownership transferred successfully")
        property.player_index = this.game.player.index
        this.game = updateGameProperties(this.game, property)
        this.game = repositionProperties(this.game)
        this.game = updatePropertiesCarouselSlide(this.game)
        // Store game data
        storeGameData(this.game, 'properties', this.game.properties)
        storeGameData(this.game, 'propertiesCount', this.game.propertiesCount)
        // Play audio
        playPurchasedPropertySound()
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
    },
    upgradeProperty: async function() {
      if(!this.game.upgradingProperty) {
        try {
          this.game.upgradingProperty = true // Prevent upgrading multiple times
          this.game.showPayInvoiceSpinner = true
          //Get lnurl pay data
          let lnurlData = await decodeLNURL(this.game.freeMarketWalletPayLink, playerWallet(this.game))
          console.log("Upgrading property...")
          // Pay property upgrade to free market pay link
          console.log("Paying property upgrade to free market pay link...")
          let res = await LNbits.api.payLnurl(
            playerWallet(this.game),
            lnurlData.callback,
            lnurlData.description_hash,
            this.game.propertyUpgrade.price * 1000, // mSats
            'Bitcoin Bitcoin Difficulty: property upgrade',
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
          '/play/api/v1/upgrade-property-miners',
          playerWallet(this.game).inkey,
          {
            game_id: this.game.id,
            player_index: this.game.player.index,
            color: property.color,
            property_id: property.property_id
          }
        )
      if(res.data) {
        console.log("Property's mining capacity upgraded successfully")
        console.log(res.data)
        this.game.properties[this.game.player.index][property.color][property.property_id].mining_capacity = res.data
        // Play audio
        playBoughtMinerSound()
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
    },
    payNetworkFee: async function() {
      if(!this.game.payingNetworkFee) {
        console.log("Paying network fee...")
        this.game.payingNetworkFee = true // Prevent paying multiple times
        this.game.showPayInvoiceSpinner = true
        // Get property owner index
        Object.keys(this.game.properties).forEach((ownerIndex) => {
          if(this.game.properties[ownerIndex][this.game.networkFeeInvoice.property.color]) {
            Object.keys(this.game.properties[ownerIndex][this.game.networkFeeInvoice.property.color]).forEach((key) => {
              let property = this.game.properties[ownerIndex][this.game.networkFeeInvoice.property.color][key]
              if(property.property_id ===  this.game.networkFeeInvoice.property.property_id) {
                this.game.networkFeeInvoice.property.player_index = property.player_index;
              }
            });
          }
        });

        // Get property owner's pay link
        let res = await LNbits.api
          .request(
            'GET',
            '/play/api/v1/player_pay_link?game_id=' + this.game.id + '&pay_link_player_index=' + this.game.networkFeeInvoice.property.player_index,
            inkey(this.game)
          )
        if(res.data) {
          let propertyOwnerPayLink = res.data.pay_link
          //Get lnurl pay data
          let lnurlData = await decodeLNURL(propertyOwnerPayLink, playerWallet(this.game))
          // Pay network fee to property owner's pay link
          console.log("Paying network fee to property owner's pay link...")
          res = await LNbits.api.payLnurl(
            playerWallet(this.game),
            lnurlData.callback,
            lnurlData.description_hash,
            this.game.networkFeeInvoice.invoiceAmount * 1000, // mSats
            'Bitcoin Bitcoin Difficulty: network fee',
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
          '/play/api/v1/update-property-income',
          playerWallet(this.game).inkey,
          {
            game_id: this.game.id,
            player_index: this.game.player.index,
            color: property.color,
            property_id: property.property_id,
            income_increment: amount
          }
        )
      if(res.data) {
        console.log("Property's cumulated mining income updated successfully")
        this.game.properties[property.player_index][property.color][property.property_id].mining_income = res.data
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
    },
    showLightningCard: async function() {
      let res = await LNbits.api
        .request(
          'POST',
          '/play/api/v1/cards/pick-card',
          playerWallet(this.game).inkey,
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
          storeGameData(this.game, 'firstLightningCardThisTurn', this.game.firstLightningCardThisTurn)
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
          '/play/api/v1/cards/pick-card',
          playerWallet(this.game).inkey,
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
          storeGameData(this.game, 'firstProtocolCardThisTurn', this.game.firstProtocolCardThisTurn)
        }
        console.log("Showing Protocol card at index " + cardIndex)
        console.log(black_swan_cards[cardIndex].imgPath)
        this.game.showProtocolCard = true;
        this.game.protocolCardToShow = black_swan_cards[cardIndex];
        playBlackSwanCardSound()
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
      let lnurlData = await decodeLNURL(this.game.freeMarketWalletPayLink, playerWallet(this.game))
      // Pay wrench attack
      console.log("Paying wrench attack...")
      let res = await LNbits.api.payLnurl(
        playerWallet(this.game),
        lnurlData.callback,
        lnurlData.description_hash,
        this.game.wrenchAttackAmountSats * 1000, // mSats
        'Bitcoin Bitcoin Difficulty: wrench attack',
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
            '/play/api/v1/update_cumulated_fines',
            playerWallet(this.game).inkey,
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
        this.game.fineAmountSats = Math.floor(card.fineMultiplier * this.game.playerBalance)
      } else if (card.fineType && card.fineType === "pct_most_recent_tx") {
        this.game.fineAmountSats = Math.floor(card.fineMultiplier * 100) // Implement once tx history is implemented
      }
      //Get lnurl pay data
      let lnurlData = await decodeLNURL(this.game.freeMarketWalletPayLink, playerWallet(this.game))
      // Pay fine
      console.log("Paying fine...")
      let res = await LNbits.api.payLnurl(
        playerWallet(this.game),
        lnurlData.callback,
        lnurlData.description_hash,
        this.game.fineAmountSats * 1000, // mSats
        'Bitcoin Bitcoin Difficulty: fine',
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
            '/play/api/v1/update_cumulated_fines',
            playerWallet(this.game).inkey,
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
      let res = await LNbits.api
        .request(
          'PUT',
          '/play/api/v1/claim_card_reward',
          playerWallet(this.game).inkey,
          {
            game_id: this.game.id,
            player_index: this.game.player.index,
            amount: this.game.rewardAmountSats
          }
        )
      if(res.status === 201) {
        console.log("Reward claimed successfully")
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
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
          '/play/api/v1/cumulated_fines?game_id=' + this.game.id,
          inkey(this.game),
        )
      if(res.data) {
        console.log(res.data)
        return res.data.cumulated_fines;
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
    },
    claimCumulatedFines: async function () {
      let res = await LNbits.api
        .request(
          'PUT',
          '/play/api/v1/claim_cumulated_fines',
          playerWallet(this.game).inkey,
          {
            game_id: this.game.id,
            player_index: this.game.player.index
          }
        )
      if(res.status === 201) {
        console.log("Cumulated fines claimed successfully")
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
      this.game.cumulatedFines = 0
      this.game.showFreeBitcoinClaimDialog = false;
    },
    claimStartAmount: async function () {
     let res = await LNbits.api
        .request(
          'PUT',
          '/play/api/v1/provide_pow',
          playerWallet(this.game).inkey,
          {
            game_id: this.game.id,
            player_index: this.game.player.index,
          }
        )
      if(res.status === 201) {
        console.log("Start bonus claimed successfully")
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
      this.game.firstStartClaimThisTurn = false;
      storeGameData(this.game, 'firstStartClaimThisTurn', this.game.firstStartClaimThisTurn)
      this.game.showStartClaimDialog = false;
    },
    getLowestBalancePlayerName: function () {
      let lowestBalance = this.game.initialFunding + 1
      let lowestBalancePlayerName = ""
      Object.keys(this.game.players).forEach((player_index) => {
        if(this.game.players[player_index].player_balance < lowestBalance) {
          lowestBalance = this.game.players[player_index].player_balance
          lowestBalancePlayerName = this.game.players[player_index].name
        }
      })
      if(lowestBalancePlayerName == this.game.players[player_index].name) {
        lowestBalancePlayerName = "yourself"
      }
      return lowestBalancePlayerName
    },
    showCamera: function () {
      this.camera.show = true
      if(window.open_camera !== "true") {
        window.open_camera = "true"
        if(freeMarketWallet(this.game)) {
          window.history.pushState({}, document.title, "/play/game?usr=" + window.user.id + "&wal=" + freeMarketWallet(this.game).id, + "&open_camera=true");
        } else if(playerWallet(this.game)) {
          window.history.pushState({}, document.title, "/play/game?usr=" + window.user.id + "&wal=" + playerWallet(this.game).id + "&open_camera=true");
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
      this.parseQRData(data, false)
    },
    /*
    enableScan: function () {
      this.camera.scanEnabled = true
      if(this.camera.data && this.camera.data.content) {
        this.decodeQR()
      }
    },
    */
    detectQR: async function (QRDataPromise) {
      this.game.QRPreview = null
      this.refreshQRPreviewKey += 1
      let QRData = await QRDataPromise
      console.log(QRData)
      if(QRData.content) {
        this.camera.data = QRData
        if(!this.camera.QRDetected) {
          this.camera.QRDetected = true
        }
        console.log(this.camera.data.content)
        this.parseQRData(this.camera.data.content, true)
      }
      /*
      if(this.camera.scanEnabled) {
        if(this.camera.data ) {
          if(this.camera.scanEnabled) {
            this.decodeQR()
          }
        }
      } else {
        // Reset closeCamera timeout
        clearTimeout(this.camera.closeTimeout)
        this.camera.closeTimeout = setTimeout(() => {
          this.closeCamera()
          this.camera.data = null;
        }, 10000)
      }
      */
    },
    generateQRPreview: function () {
      console.log("generate QR preview")

      switch(this.game.QRPreview.type) {
        case "invoice":
          this.game.QRPreview.text = "INVOICE: " + this.game.QRPreview.data.amount + " SATS"
          break;
        case "tax":
          this.game.QRPreview.text = "TAXATION IS THEFT :("
          break;
        case "network_fee":
          this.game.QRPreview.text = "NETWORK FEE: " + this.game.QRPreview.data.amount + " SATS"
          break;
        case "not_your_turn":
          this.game.QRPreview.text = "NOT YOUR TURN :/"
          break;
        case "property":
          this.game.QRPreview.imagePath =  this.game.QRPreview.data.property.imgPath
          break;
        case "property_sale":
          this.game.QRPreview.imagePath =  this.game.QRPreview.data.property.imgPath
          break;
        case "lightning":
          this.game.QRPreview.text = "LIGHTNING CARD"
          break;
        case "protocol":
          this.game.QRPreview.text = "PROTOCOL CARD"
          break;
        case "start":
          this.game.QRPreview.text = "START BONUS"
          break;
        case "free_bitcoin":
          this.game.QRPreview.text = "FREE BITCOIN :)"
          break;
        default:
          this.game.QRPreview.text = "Invalid QR preview data type"
          console.log("Invalid QR preview data type")
          break
      }
      this.refreshQRPreviewKey += 1

      console.log(this.game.QRPreview)
    },
    decodeQR: function () {
      let QRData = this.camera.data.content
      this.camera.data = null
      this.closeCamera()
      this.parseQRData(QRData, false)
    },
    parseQRData: async function (QRData, preview = false) {
      // Regular lightning invoice case
      if(QRData.slice(0, 2) == "ln") {
        const invoice = decodeInvoice(QRData);
        console.log(invoice)
        console.log(invoice.sat)
        if(preview) {
          this.game.QRPreview = {
            type: "invoice",
            data: {
              amount: invoice.sat.toString()
            }
          }
        } else  {
          this.game.invoiceAmount = invoice.sat.toString()
          this.game.invoice = QRData
          this.game.showPayInvoiceDialog = true
        }
      } else  {
        console.log(QRData)
        switch(QRData.slice(0,1)) {
          case "I": // Player invoice
            if(preview) {
              this.game.QRPreview = {
                type: "invoice",
                data: {
                  amount: QRData.slice(2)
                }
              }
            } else  {
              this.game.invoice = QRData
              this.game.invoiceRecipientIndex = QRData.slice(1,2)
              this.game.invoiceAmount = QRData.slice(2)
              // Get invoice recipient's name and wallet _id
              if(this.game.invoiceRecipientIndex === "0") {
                this.game.invoiceRecipientName = "the free market"
              } else {
                Object.keys(this.game.players).forEach((player_index) => {
                  if(player_index === this.game.invoiceRecipientIndex) {
                    this.game.invoiceRecipientName = this.game.players[player_index].name
                  }
                })
              }
              this.game.showPayInvoiceDialog = true
            }
            break

          case "P": // Property card
            if(QRData.slice(1,7) == "00ff00") { // Fix for Taxation is theft (formerly wrench attacks) (TO DO: use dedicated QR codes T1 and T2)
              if(this.game.playerTurn === this.game.player.index) {
                if(preview) {
                  this.game.QRPreview = {
                    type: "tax",
                  }
                } else  {
                  playTaxationIsTheftSound()
                  this.showWrenchAttackDialog(QRData.slice(7,8))
                }
              } else {
                if(preview) {
                  this.game.QRPreview = {
                    type: "not_your_turn",
                  }
                } else  {
                  this.showNotYourTurnPopUp()
                }
              }
            } else {
              let propertyToShow = Object.assign({}, properties[QRData.slice(1,7)][QRData.slice(7,8)])
              if(preview) {
                this.game.QRPreview = {
                  type: "property",
                  data: {
                    property: propertyToShow
                  }
                }
              } else  {
                this.closePropertyDialog()
                this.showPropertyDetails(propertyToShow)
              }
            }
            break

          case "L": // Development card (formerly Lightning card)
            if(this.game.playerTurn === this.game.player.index) {
              if(preview) {
                this.game.QRPreview = {
                  type: "lightning",
                }
              } else  {
                this.showLightningCard()
              }
            } else {
              if(preview) {
                this.game.QRPreview = {
                  type: "not_your_turn",
                }
              } else  {
                this.showNotYourTurnPopUp()
              }
            }
            break

          case "B": // Black swan card (formerly Protocol card)
            if(this.game.playerTurn === this.game.player.index) {
              if(preview) {
                this.game.QRPreview = {
                  type: "protocol",
                }
              } else  {
                this.showProtocolCard()
              }
            } else {
              if(preview) {
                this.game.QRPreview = {
                  type: "not_your_turn",
                }
              } else  {
                this.showNotYourTurnPopUp()
              }
            }
            break

          case "S": // Property sale
            let propertyForSale = Object.assign({}, properties[QRData.slice(1,7)][QRData.slice(7,8)])
            if(preview) {
              this.game.QRPreview = {
                type: "property_sale",
                data: {
                  property: propertyForSale
                }
              }
            } else  {
              this.closePropertyDialog()
              this.game.showPropertyPurchaseDialog = true
              this.game.propertyPurchase.property = propertyForSale
              this.game.propertyPurchase.property.price = QRData.slice(8)
            }
            break

          case "N": // Network fee
            if(preview) {
              this.game.QRPreview = {
                type: "network_fee",
                data: {
                  amount: QRData.slice(8)
                }
              }
            } else  {
              this.closePropertyDialog()
              this.game.networkFeeInvoice.property = Object.assign({}, properties[QRData.slice(1,7)][QRData.slice(7,8)])
              this.game.networkFeeInvoice.invoiceAmount = QRData.slice(8)
              this.game.showNetworkFeePaymentDialog = true
            }
            break

          case "F": // Free Bitcoin
            if(this.game.playerTurn === this.game.player.index) {
              if(preview) {
                this.game.QRPreview = {
                  type: "free_bitcoin",
                }
              } else  {
                this.showFreeBitcoinClaimDialog()
              }
            } else {
              if(preview) {
                this.game.QRPreview = {
                  type: "not_your_turn",
                }
              } else  {
                this.showNotYourTurnPopUp()
              }
            }
            break

          case "T": // Start
            if(this.game.playerTurn === this.game.player.index) {
              if(preview) {
                this.game.QRPreview = {
                  type: "start",
                }
              } else  {
                this.showStartClaimDialog()
              }
            } else {
              if(preview) {
                this.game.QRPreview = {
                  type: "not_your_turn",
                }
              } else  {
                this.showNotYourTurnPopUp()
              }
            }
            break

          default:
            console.log("Invalid data type")
            break
        }
      }
      if(preview) {
        this.generateQRPreview()
      }
    },
    closeQRDialog: function () {
      this.qrCodeDialog.show = false
    },
    closeGameWarning: function () {
      this.game.showWarningMessage = false
      storeGameData(this.game, 'showWarningMessage', this.game.showWarningMessage)
    }
  }
})
