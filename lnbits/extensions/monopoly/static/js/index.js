import { properties } from './data/properties.js'
import { chance_cards, community_chest_cards } from './data/cards.js'
import { newGame, playerNames } from './data/data.js'
import { reactiveStyles } from '../css/styles.js'
import { decodeInvoice } from './helpers/utils.js'
import { onGameFunded, fetchPlayers } from './calls/database.js'
import { loadGameData, initGameData } from './helpers/init.js'
import { fetchPlayerBalance, deleteGameVoucher } from './calls/api.js'
import {
  dragOptions,
  onMove,
  onDragged
} from './helpers/animations.js'
import {
  checkPlayerBalance,
  checkBankBalance,
  checkPlayers,
  checkPlayersBalances,
  checkFundingInvoicePaid,
  checkPlayerInvoicePaid
} from './calls/intervals.js'


Vue.component(VueQrcode.name, VueQrcode)
Vue.use(VueQrcodeReader)

const game = loadGameData();

new Vue({
  el: '#vue',
  mixins: [windowMixin],
  data: function() {
    const initializedGame = initGameData(game)
    return {
      game: initializedGame,
      camera: {
        data: null,
        show: false,
        camera: 'auto'
      },
      qrCodeDialog: {
        data: null,
        show: false
      },
      fundingTab: 'paylnurl',
      // data for draggable cards
      enabled: true,
      isDragging: false,
      delayedDragging: false
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
    // Logic to create a new game and a dedicated wallet for game creator (called from index.html)
    createGame: async function () {
      // Create bank wallet and dedicated player wallet for game creator
      await this.createBankAndPlayerWallet();
      // Create a static LNURL pay link to be used for funding bank
      await this.createBankPayLNURL();
      // Initialize Chance and Community Chest cards indexes
      await this.initializeCards()
      // Start checking user balance
      await fetchPlayerBalance(this.game)
      this.checkPlayerBalance()
      // Start checking bank balance
      this.checkBankBalance()
      // Start checking players
      await fetchPlayers(this.game)
      this.checkPlayers()
      // Start checking players balances
      this.checkPlayersBalances()
      // Display the view for initial bank funding
      this.game.showFundingView = true;
      // Register game data in local storage
      localStorage.setItem(
        'monopoly.game_' + this.game.bankData.id + '_' + this.game.player.wallets[0].id + '.showFundingView',
        this.game.showFundingView
      )
      this.game.playersCount = 1;
      localStorage.setItem(
        'monopoly.game_' + this.game.bankData.id + '_' + this.game.player.wallets[0].id + '.playersCount',
        this.game.playersCount
      )
      // Refresh page to display newly created player wallet
      window.location.reload();
    },
    // Logic to create bank wallet and dedicated player wallet for game creator
    createBankAndPlayerWallet: async function () {
      // Create bank wallet
      let res = await LNbits.api
        .request(
          'POST',
          '/usermanager/api/v1/users',
          this.g.user.wallets[0].inkey,
          {
            admin_id: this.g.user.id,
            user_name: "Bank",
            wallet_name: "Bank safe",
            email: "",
            password: ""
          }
        )
      if(res.data) {
        this.game.bankData = res.data
        console.log("Monopoly: Bank wallet created successfully")
        // Create player wallet for game creator
        await this.createPlayerWallet();
        // Register game in database
        res = await LNbits.api
          .request(
            'POST',
            '/monopoly/api/v1/games',
            this.g.user.wallets[0].inkey,
            {
              admin_wallet_id: this.game.player.wallet_id,
              bank_id: this.game.bankData.id,
              max_players_count: this.game.maxPlayersCount,
              available_player_names: playerNames
            }
          )
        if(res.data) {
          console.log("Monopoly: Game registered successfully (" + res.config.data+ ")")
          // Update player wallet for game creator (pick random name)
          await this.updatePlayerWallet();
          // Update created game with first player data
          this.game.players[this.game.player.wallets[0].id] = {
            player_wallet_id: this.game.player.wallets[0].id,
            player_wallet_name: this.game.player.wallets[0].name,
            player_wallet_inkey: this.game.player.wallets[0].inkey,
          }
          this.game.playersData.rows.push(
            {
              name: this.game.player.wallets[0].name,
              balance: 0
            }
          )
          this.game.created = true
          this.game.fundingStatus = 'awaiting'
          // Register new game in local storage
          let existingGameRecords = JSON.parse(localStorage.getItem('monopoly.gameRecords'))
          if(existingGameRecords && existingGameRecords.length) {
            existingGameRecords.push('game_' + this.game.bankData.id + '_' + this.game.player.wallets[0].id)
          } else {
            existingGameRecords = ['game_' + this.game.bankData.id + '_' + this.game.player.wallets[0].id]
          }
          localStorage.setItem('monopoly.gameRecords', JSON.stringify(existingGameRecords))
          Object.keys(this.game).forEach((key) => {
            if(typeof(this.game[key]) == 'object'){
              localStorage.setItem(
                'monopoly.game_' + this.game.bankData.id + '_' + this.game.player.wallets[0].id + '.' + key,
                JSON.stringify(this.game[key])
              )
            } else {
                localStorage.setItem(
                  'monopoly.game_' + this.game.bankData.id + '_' + this.game.player.wallets[0].id + '.' + key,
                  this.game[key]
                )
            }
          })
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
            bank_id: this.game.bankData.id,
            user_id: this.g.user.id
          }
        )
      if(res.data) {
        this.game.player.wallet_id = res.data.id
        console.log("Monopoly: Player wallet created successfully (" + res.data.id + ")")
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
            bank_id: this.game.bankData.id,
            player_wallet_id: this.game.player.wallet_id
          }
        )
      if(res.data) {
        console.log("Monopoly: Player wallet updated successfully (" + res.data.id + ")")
        this.g.user.wallets.push(res.data)
        this.game.player.id = this.g.user.id;
        this.game.player.name = res.data.name;
        this.game.player.wallets.push(res.data);
      }
    },
    // Logic to create a static LNURL pay link to be used for funding bank
    createBankPayLNURL: async function () {
      const payLNURLData = {
        description: "Monopoly bank pay link",
        min: 1,
        max: 1000000,
        comment_chars: 100,
        success_text: "Payment to bank confirmed"
      }
      // Create LNURL pay link
      let res = await LNbits.api
        .request('POST', '/lnurlp/api/v1/links', this.game.bankData.wallets[0].adminkey, payLNURLData);
      if(res.data) {
        const payLinkId = res.data.id
        const payLink = res.data.lnurl
        // Register LNURL pay link in database
        res = await LNbits.api
          .request(
            'POST',
            '/monopoly/api/v1/games/paylink',
            this.game.player.wallets[0].inkey,
            {
              bank_id: this.game.bankData.id,
              pay_link_id: payLinkId,
              pay_link: payLink
            }
          )
        if(res.data) {
          console.log("Monopoly: LNURL pay link created successfully " + payLink)
          // Save lnurl pay link id in local storage
          this.game.lnurlPayLinkId = payLinkId;
          this.game.lnurlPayLink = payLink;
          localStorage.setItem(
            'monopoly.game_' + this.game.bankData.id + '_' + this.game.player.wallets[0].id + '.lnurlPayLinkId',
            this.game.lnurlPayLinkId.toString()
          )
          localStorage.setItem(
            'monopoly.game_' + this.game.bankData.id + '_' + this.game.player.wallets[0].id + '.lnurlPayLink',
            this.game.lnurlPayLink.toString()
          )
        } else {
          LNbits.utils.notifyApiError(res.error)
        }
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
    },
    initializeCards: async function () {
      // Initialize chance and community chest cards indexes
      const res = await LNbits.api
        .request(
          'POST',
          '/monopoly/api/v1/cards/init_cards_indexes',
          user.wallets[0].inkey,
          {
            bank_id: this.game.bankData.id
          },
        )
      if(res.status == 201) {
        console.log("Monopoly: Chance and Community Chest cards indexes initialized successfully ")
      }
    },
    // Logic to format an invite link to invite other players to the game
    formatInviteLink: async function () {
      // Get voucher from database using bank invoice key
      let res = await LNbits.api
        .request(
          'GET',
          '/withdraw/api/v1/links/' + this.game.lnurlVoucherId,
          this.game.bankData.wallets[0].inkey
        )
      if(res.data) {
        return "https://" + window.location.hostname +
          "/monopoly/api/v1/invite?game_id=" + this.game.bankData.id +
          "&voucher=" + res.data.lnurl;
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
    },
    // Logic to create an invoice to fund the bank wallet
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
          this.game.bankData.wallets[0],
          this.game.fundingInvoice.data.amount,
          this.game.fundingInvoice.data.memo,
          this.game.fundingInvoice.unit,
          this.game.fundingInvoice.lnurl && this.game.fundingInvoice.lnurl.callback
        )
        if(res.data) {
          this.game.fundingInvoice.paymentReq = res.data.payment_request
          this.game.fundingInvoice.paymentHash = res.data.payment_hash

          console.log(this.game.fundingInvoice.paymentReq)

          // Save funding invoice in local storage
          localStorage.setItem(
            'monopoly.game_' + this.game.bankData.id + '_' + this.game.player.wallets[0].id + '.fundingInvoice',
            JSON.stringify(this.game.fundingInvoice)
          )
          // Once invoice has been created and saved, start checking for payments
          this.checkFundingInvoicePaid(invoiceReason)
        } else {
          LNbits.utils.notifyApiError(res.error)
        }
      } else  {
        LNbits.utils.notifyApiError(res.error)
        this.game.fundingStatus = 'error'
      }
    },
    // Logic to create an invoice for player to request funds
    createPlayerInvoice: async function (invoiceReason = null) {
      // Erase previous player invoice
      this.game.playerInvoice.paymentReq = null
      this.game.playerInvoice = newGame.playerInvoice
      if(this.game.playerInvoiceAmount && this.game.playerInvoiceAmount > 0) {
        // Generate new player invoice
        this.game.playerInvoice.data.amount = this.game.playerInvoiceAmount
        if (LNBITS_DENOMINATION !== 'sats') {
          this.game.playerInvoice.data.amount = this.game.playerInvoice.data.amount * 100
        }
        let res = await LNbits.api.createInvoice(
          this.game.player.wallets[0],
          this.game.playerInvoice.data.amount,
          this.game.playerInvoice.data.memo,
          this.game.playerInvoice.unit,
          this.game.playerInvoice.lnurl && this.game.playerInvoice.lnurl.callback
        )
        if(res.data) {
          this.game.playerInvoice.paymentReq = res.data.payment_request
          this.game.playerInvoice.paymentHash = res.data.payment_hash

          console.log(this.game.playerInvoice.paymentReq)

          // Save funding invoice in local storage
          localStorage.setItem(
            'monopoly.game_' + this.game.bankData.id + '_' + this.game.player.wallets[0].id + '.playerInvoice',
            JSON.stringify(this.game.playerInvoice)
          )
          // Once invoice has been created and saved, start checking for payments
          this.checkPlayerInvoicePaid(invoiceReason)
        } else {
          LNbits.utils.notifyApiError(res.error)
        }
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
    // Logic to display the bank funding dialog component
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
      await this.deleteGameVoucher()
      // Stop checking for new players
      clearInterval(game.playersChecker)
      // Start game
      this.game.started = true;
      // Save game status in database
      const res = await LNbits.api
        .request(
          'PUT',
          '/monopoly/api/v1/games/start',
          user.wallets[0].inkey,
          {
            bank_id: this.game.bankData.id,
            started: this.game.started
          }
        )
      if(res.data) {
        // Save game status in local storage
        localStorage.setItem(
          'monopoly.game_' + this.game.bankData.id + '_' + this.game.player.wallets[0].id + '.started',
          this.game.started.toString()
        )
        console.log("GAME STARTED")
      }
    },
    deleteGameVoucher: async function () {
      await deleteGameVoucher(this.game)
    },
    checkFundingInvoicePaid: function (invoiceReason = null) {
      checkFundingInvoicePaid(this.game, invoiceReason)
    },
    checkPlayerInvoicePaid: function (invoiceReason = null) {
      checkPlayerInvoicePaid(this.game, invoiceReason)
    },
    // Called from index.html
    onGameFunded: function () {
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
    checkBankBalance: async function () {
      await checkBankBalance(this.game)
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
    createNetworkFeeInvoice: async function (property) {
      this.game.showSaleInvoiceDialog = false;
      this.erasePropertyInvoices()
      this.game.playerInvoiceAmount = property.networkFee[property.mining_capacity]
      await this.createPlayerInvoice({
        type: "network_fee",
        propertyId: property.id
      });
      this.game.networkFeeInvoiceData = JSON.stringify({
        type: "network_fee",
        propertyColor: property.color,
        propertyId: property.id,
        invoice: this.game.playerInvoice.paymentReq,
      })
      this.game.showPropertyDialog = false;
      this.game.showPropertyInvoiceDialog = true;
      this.game.showNetworkFeeInvoice = true;
    },
    openSaleInvoiceDialog: async function (property) {
      this.game.showNetworkFeeInvoice = false;
      this.erasePropertyInvoices()
      this.game.showPropertyDialog = false;
      this.game.showPropertyInvoiceDialog = true;
      this.game.showSaleInvoiceDialog = true;
    },
    createUpgradeInvoice: async function (property) {
      this.erasePropertyInvoices()
      this.game.fundingInvoiceAmount = property.miningCapacity < 4
        ? property.oneKwPrice
        : property.tenKwPrice
      await this.createFundingInvoice();
      this.game.propertyUpgradeData = JSON.stringify({
        type: "property_upgrade",
        propertyColor: property.color,
        propertyId: property.id,
        invoice: this.game.fundingInvoice.paymentReq,
      })
      this.game.showPropertyDialog = false;
      this.game.upgradeInvoiceCreated = true;
      this.game.showPropertyInvoiceDialog = true;
    },
    createPurchaseInvoice: async function (property) {
      this.erasePropertyInvoices()
      this.game.fundingInvoiceAmount = property.price;
      await this.createFundingInvoice();
      this.game.propertyPurchaseData = JSON.stringify({
        type: "property_purchase",
        propertyColor: property.color,
        propertyId: property.id,
        invoice: this.game.fundingInvoice.paymentReq,
      })
      this.game.showPropertyDialog = false;
      this.game.purchaseInvoiceCreated = true;
      this.game.showPropertyInvoiceDialog = true;
    },
    createSaleInvoice: async function (property, amount) {
      this.erasePropertyInvoices()
      this.game.playerInvoiceAmount = amount;
      await this.createPlayerInvoice();
      this.game.propertySaleData = JSON.stringify({
        type: "property_sale",
        propertyColor: property.color,
        propertyId: property.id,
        invoice: this.game.playerInvoice.paymentReq,
      })
      this.game.saleInvoiceCreated = true;
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
    erasePropertyInvoices: function() {
      this.game.propertyPurchaseData = null;
      this.game.propertySaleData = null;
      this.game.playerInvoiceAmount = null;
      this.game.playerInvoice.paymentReq = null;
      this.game.playerInvoice = newGame.playerInvoice;
      this.game.fundingInvoice.paymentReq = null;
      this.game.fundingInvoice = newGame.fundingInvoice;
      this.game.playerVoucherId = null;
      this.game.playerVoucher = null;
      this.game.networkFeeInvoiceCreated = false;
      this.game.saleInvoiceCreated = false;
      this.game.upgradeInvoice = false;
      this.game.purchaseInvoiceCreated = false;
      this.game.offerVoucher = false;
      this.game.upgradeInvoiceCreated = false;
      this.game.propertyUpgradeData = null;
    },
    purchaseProperty: async function() {
      // Pay invoice
      console.log(this.game.propertyPurchase.invoice)
      console.log("Purchasing property...")
      let res = await LNbits.api.payInvoice(this.game.player.wallets[0], this.game.propertyPurchase.invoice);

      if(res.data && res.data.payment_hash) {
        console.log("Property purchase was paid successfully")
        this.closePropertyPurchaseDialog()
        // Check if property is already registered in  database
        try  {
          res = await LNbits.api
            .request(
              'GET',
              '/monopoly/api/v1/property?bank_id=' + this.game.bankData.id
              + '&property_color=' + this.game.propertyPurchase.property.color
              + '&property_id=' + this.game.propertyPurchase.property.id,
              this.game.player.wallets[0].inkey,
            )

          console.log(res)

          if(res.data) {
            console.log("Property already registered, updating ownership")
            await this.transferPropertyOwnership(this.game.propertyPurchase.property, this.game.player.wallets[0].id)
          } else  {
            console.log("Property not registered, registering")
            await this.registerProperty(this.game.propertyPurchase.property, this.game.player.wallets[0].id)
          }
        } catch(err) {
            console.log(err)
            console.log("Property not registered, registering")
            await this.registerProperty(this.game.propertyPurchase.property, this.game.player.wallets[0].id)
        }
      } else {
        LNbits.utils.notifyApiError(res.error)
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
            bank_id: this.game.bankData.id
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
            bank_id: this.game.bankData.id,
            property_color: property.color,
            property_id:property.id,
            new_owner: buyer
          }
        )
      if(res.data) {
        console.log("Property ownership transferred successfully")
        console.log(res.data)
      }
    },
    upgradeProperty: async function() {
      // Pay invoice
      console.log(this.game.propertyUpgrade.invoice)
      console.log("Upgrading property...")
      let res = await LNbits.api.payInvoice(this.game.player.wallets[0], this.game.propertyUpgrade.invoice);

      if(res.data && res.data.payment_hash) {
        console.log("Property upgrade was paid successfully")
        this.closePropertyUpgradeDialog()

        console.log("Updating property's mining capacity")
        await this.upgradePropertyMiningCapacity(this.game.propertyUpgrade.property)

      } else {
        LNbits.utils.notifyApiError(res.error)
      }
    },
    upgradePropertyMiningCapacity: async function(property) {
      let res = await LNbits.api
        .request(
          'PUT',
          '/monopoly/api/v1/property/upgrade',
          this.game.player.wallets[0].inkey,
          {
            bank_id: this.game.bankData.id,
            property_color: property.color,
            property_id:property.id
          }
        )
      if(res.data) {
        console.log("Property's mining capacity upgraded successfully")
        console.log(res.data)
      }
    },
    payNetworkFee: async function() {
      // Pay invoice
      console.log(this.game.networkFeeInvoice.invoice)
      console.log("Paying network fee...")
      let res = await LNbits.api.payInvoice(this.game.player.wallets[0], this.game.networkFeeInvoice.invoice);

      if(res.data && res.data.payment_hash) {
        console.log("Network fee was paid successfully")
        this.closeNetworkFeePaymentDialog()

        console.log("Updating property's cumulated mining income")
        await this.updatePropertyMiningIncome(this.game.networkFeeInvoice.property, this.game.networkFeeInvoice.invoiceAmount)
      } else {
        LNbits.utils.notifyApiError(res.error)
      }
    },
    updatePropertyMiningIncome: async function(property, amount) {
      console.log(amount)

      let res = await LNbits.api
        .request(
          'PUT',
          '/monopoly/api/v1/property/update-income',
          this.game.player.wallets[0].inkey,
          {
            bank_id: this.game.bankData.id,
            property_color: property.color,
            property_id:property.id,
            income_increment: amount
          }
        )
      if(res.data) {
        console.log("Property's cumulated mining income updated successfully")
        console.log(res.data)
      }
    },
    showChanceCard: async function() {
      let res = await LNbits.api
        .request(
          'GET',
          '/monopoly/api/v1/next_chance_card_index?bank_id=' + this.game.bankData.id,
          this.game.player.wallets[0].inkey,
        )
      if(res.data) {
        let chanceCard = res.data
        console.log("Showing Chance card at index " + chanceCard.next_index.toString())
        console.log(chance_cards[chanceCard.next_index.toString()].imgPath)
        this.game.showChanceCard = true;
        this.game.chanceCardToShow = chance_cards[chanceCard.next_index.toString()];
        // Update next Chance card index
        res = await LNbits.api
          .request(
            'PUT',
            '/monopoly/api/v1/cards/update_next_card_index',
            this.game.player.wallets[0].inkey,
            {
              bank_id: this.game.bankData.id,
              card_type: "chance"
            }
          )
        if(res.data) {
          console.log("Next Chance card index updated successfully")
          console.log(res.data)
        }
      }
    },
    showCommunityChestCard: async function() {
      let res = await LNbits.api
        .request(
          'GET',
          '/monopoly/api/v1/next_community_chest_card_index?bank_id=' + this.game.bankData.id,
          this.game.player.wallets[0].inkey,
        )
      if(res.data) {
        let communityChestCard = res.data
        console.log("Showing Community Chest card at index " + communityChestCard.next_index.toString())
        console.log(chance_cards[communityChestCard.next_index.toString()].imgPath)
        this.game.showCommunityChestCard = true;
        this.game.communityChestCardToShow = community_chest_cards[communityChestCard.next_index.toString()] ;;
        // Update next Community Chest card index
        res = await LNbits.api
          .request(
            'PUT',
            '/monopoly/api/v1/cards/update_next_card_index',
            this.game.player.wallets[0].inkey,
            {
              bank_id: this.game.bankData.id,
              card_type: "community_chest"
            }
          )
        if(res.data) {
          console.log("Next Community Chest card index updated successfully")
          console.log(res.data)
        }
      }
    },
    // Unused functions (but may be used at some point)
    exportBank: function () {
      this.qrCodeDialog.data = JSON.stringify(
        {
          id: this.game.bankData.id,
          walletId: this.game.bankData.wallets[0].id,
          adminKey: this.game.bankData.wallets[0].adminkey, // Passing bank wallet admin key so that all players can pay from the bank
          inKey: this.game.bankData.wallets[0].inkey // Passing bank wallet admin key so that all players can fetch bank balance
        }
      )
      this.qrCodeDialog.show = true
    },
    closeBankExportQR: function () {
      this.qrCodeDialog.show = false
    },
    importBank: function () {
      this.showCamera()
    },
    showCamera: function () {
      this.camera.show = true
    },
    closeCamera: function () {
      this.camera.show = false
    },
    hasCamera: function () {
      navigator.permissions.query({name: 'camera'}).then(res => {
        return res.state == 'granted'
      })
    },
    decodeQR: function (res) {
      this.camera.data = res
      this.camera.show = false
      this.parseQRData(this.camera.data)
    },

    parseQRData: async function (QRData) {
      let data = JSON.parse(QRData)
      console.log(data)
      console.log(data.type)

      switch(data.type) {
        case "property_card":
          this.closePropertyDialog()
          this.showPropertyDetails(properties[data.color][data["id'"]]) // TO DO: fix QR codes data (currently has key id' instead of id)
          break

        case "chance_card":
          this.closePropertyDialog()
          this.showChanceCard()
          break

        case "community_chest_card":
          this.closePropertyDialog()
          this.showCommunityChestCard()
          break

        case "property_purchase":
          this.closePropertyDialog()
          const purchaseInvoice = decodeInvoice(data.invoice);
          this.game.showPropertyPurchaseDialog = true
          this.game.propertyPurchase.property = properties[data.propertyColor][data.propertyId]
          this.game.propertyPurchase.invoice = data.invoice
          this.game.propertyPurchase.invoiceAmount = purchaseInvoice.sat
          break

        case "property_upgrade":
          this.closePropertyDialog()
          const upgradeInvoice = decodeInvoice(data.invoice);
          this.game.showPropertyUpgradeDialog = true
          this.game.propertyUpgrade.property = properties[data.propertyColor][data.propertyId]
          this.game.propertyUpgrade.invoice = data.invoice
          this.game.propertyUpgrade.invoiceAmount = upgradeInvoice.sat
          break

        case "property_sale":
          this.closePropertyDialog()
          const saleInvoice = decodeInvoice(data.invoice);
          this.game.showPropertyPurchaseDialog = true
          this.game.propertyPurchase.property = properties[data.propertyColor][data.propertyId]
          this.game.propertyPurchase.invoice = data.invoice
          this.game.propertyPurchase.invoiceAmount = saleInvoice.sat
          break

        case "network_fee":
          this.closePropertyDialog()
          const networkFeeInvoice = decodeInvoice(data.invoice);
          this.game.showNetworkFeePaymentDialog = true
          this.game.networkFeeInvoice.property = properties[data.propertyColor][data.propertyId]
          this.game.networkFeeInvoice.invoice = data.invoice
          this.game.networkFeeInvoice.invoiceAmount = networkFeeInvoice.sat
          break

        default:
          console.log("Invalid data type")
          break
      }

      /*
      if(
        data.id // User Id of the bank user
        && data.walletId // Wallet Id of the bank wallet
        && data.adminKey // Bank wallet admin key
        && data.inKey // Bank wallet invoice key
      ) {
        this.game.bankData.id = data.id
        this.game.bankData.wallets = [{
          id: data.walletId,
          adminkey: data.adminKey,
          inkey: data.inKey
        }]
        // Get full bank data from database
        let res = await LNbits.api
          .request(
            'GET',
            '/monopoly/api/v1/game_with_invoice?bank_id=' + this.game.bankData.id,
            this.g.user.wallets[0].inkey
          )
          if(res.data) {
            this.game.initialFunding = res.data[2][1]
            this.game.fundingInvoice.paymentReq = res.data[3][1]
            this.game.fundingInvoice.paymentHash = res.data[4][1]
            this.game.imported = true
            this.game.fundingStatus = 'awaiting'
            this.game.players[this.g.user.wallets[0].id] = {
              wallet_id: this.g.user.wallets[0].id,
              wallet_name: this.g.user.wallets[0].name,
              wallet_inkey: this.g.user.wallets[0].inkey
            }
            // Save game data in local storage
            localStorage.setItem(
              'monopoly.game',
              JSON.stringify(this.game)
            )
            // Register new player in database
            res = await LNbits.api
              .request(
                'POST',
                '/monopoly/api/v1/players',
                this.g.user.wallets[0].inkey,
                {
                  player_wallet_id: this.g.user.wallets[0].id,
                  player_wallet_name: this.g.user.wallets[0].name,
                  player_wallet_inkey: this.g.user.wallets[0].inkey,
                  bank_id: this.game.bankData.id
                }
              )
            if(res.data) {
              console.log("Monopoly: " + this.g.user.wallets[0].name + " registered successfully")
              console.log("Monopoly: Bank wallet imported successfully (initial funding: " + this.game.initialFunding + ")")
              // Start checking for new players
              // this.checkPlayers()
              // Start check for funding
              this.checkGameFundingReceived()
            } else {
              LNbits.utils.notifyApiError(res.error)
            }
          } else {
            LNbits.utils.notifyApiError(res.error)
          }
        } else {
        console.log("Monopoly: Error: could not import bank wallet")
      }
      */
    },
  }
})
