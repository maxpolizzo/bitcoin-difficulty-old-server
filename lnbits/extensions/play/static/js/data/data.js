// Game data templates
export const newGame = {
  //////////////////////////////////////////////////////////////////////////////
  // Static data
  //////////////////////////////////////////////////////////////////////////////
  minFunding: 20000,
  startClaimAmount: 200,
  minPlayersCount: "2",
  maxPlayersCount: "6",
  // Hack to copy command to pay funding invoice from local regtest node
  payInvoiceCommand: "lncli -n regtest --lnddir=\"/Users/maximesuard/Dev/Bitcoin/lnd-regtest-2\" --rpcserver=localhost:11009 payinvoice ",
  //////////////////////////////////////////////////////////////////////////////
  // Data persisted in database which needs to be fetched only once at reload
  //////////////////////////////////////////////////////////////////////////////
  id: null,
  freeMarketWallet: null,
  freeMarketWalletPayLinkId: null,
  freeMarketWalletPayLink: null,
  freeMarketLiquidity: 0,
  player: {
    id: null,
    clientId: null,
    index: null, // db.players[player_user_id].player_index
    name: null, // db.players[player_user_id].player_wallet_name
    wallet: null, // db.players[player_user_id] or fetch player.wallets from LNBits API?
    active: true
  },
  started: false, // db.games[game_id].started
  created: false, // db.games[game_id].admin_user_id == player_user_id
  imported: false, // db.games[game_id].admin_user_id != player_user_id
  timestamp: null, // db.players[player_user_id].time
  fundingStatus: 'pending', // db.games[game_id].initial_funding > 0
  initialFunding: null, // db.games[game_id].initial_funding
  initialPlayerBalance: "0", // db.games[game_id].initial_player_balance
  inviteVoucherId: null, // db.games[game_id].invite_voucher_id
  firstLightningCardThisTurn: true, // db.players[player_user_id].first_lightning_card_this_turn
  firstProtocolCardThisTurn: true, // db.players[player_user_id].first_protocol_card_this_turn
  firstStartClaimThisTurn: true, // db.players[player_user_id].first__start_claim_this_turn
  playerWallet: {
    payments: {}// db.payments[player_wallet_id]
  },
  players: {}, // db.players (get with fetchPlayers(game))
  playersData: {
    columns: [
      {
        name: 'name',
        required: true,
        label: 'Name',
        align: 'left',
        field: 'name',
        format: val => `${val}`,
        sortable: false
      },
      {
        name: 'balance',
        required: true,
        label: 'Balance (sats)',
        align: 'center',
        field: 'balance',
        format: val => `${val}`,
        sortable: true
      },
      {
        name: 'propertiesCount',
        required: true,
        label: 'Properties',
        align: 'center',
        field: 'propertiesCount',
        format: val => `${val}`,
        sortable: true
      },
    ],
    rows: [] // db.players (get with fetchPlayers(game))
  },
  playersCount: 0, // db.players (get with fetchPlayers(game))
  properties: {}, // db.properties (get with fetchProperties(game))
  propertiesCount: {}, // db.properties (get with fetchProperties(game))
  propertiesCarouselSlide: "", // Set with fetchProperties(game) on reload
  //////////////////////////////////////////////////////////////////////////////
  // Data persisted in database which needs to be fetched regularly during game
  //////////////////////////////////////////////////////////////////////////////
  playerTurn: 0, // db.games[game_id].player_turn (get with fetchPlayerTurn(game))
  playerBalance: 0, // db.players[player_user_id].player_balance (get with fetchPlayerBalance(game))

  //////////////////////////////////////////////////////////////////////////////
  // Other data (not persisted in database)
  //////////////////////////////////////////////////////////////////////////////
  rewardVoucher: null,
  inviteLink: null,
  showWarningMessage: true,
  showInviteButton: false,
  showFundingView: false,
  showFundingDialog: false,
  showInviteQR: false,
  enableStartGame: false,
  waitingForPlayersIndexes: [],
  showExplanationText: false,
  showPayInvoiceDialog: false,
  showPlayerInvoiceDialog: false,
  showPropertyDialog: false,
  showPropertyInvoiceDialog: false,
  showPropertyPurchaseDialog: false,
  showPropertyUpgradeDialog: false,
  showSaleInvoiceDialog: false,
  showFreeBitcoinClaimDialog: false,
  showStartClaimDialog: false,
  showLightningCard: false,
  showProtocolCard: false,
  showWrenchAttackDialog: false,
  showPayFineSpinner: false,
  showPayInvoiceSpinner: false,
  showNotYourTurnPopUp: false,
  showAlreadyClaimedStartBonusPopUp: false,
  showNetworkFeeInvoiceDialog: false,
  showNetworkFeeInvoice: false,
  showDeactivatePlayerDialog: false,
  playerToDeactivateIndex: null,
  playerToDeactivateName: null,
  showDeactivatePlayerSpinner: false,
  propertyToShow: {},
  lightningCardToShow: null,
  protocolCardToShow: null,
  wrenchAttackAmountSats: null,
  saleInvoiceCreated: false,
  purchaseInvoiceCreated: false,
  upgradeInvoiceCreated: false,
  invoice: null,
  invoiceRecipientIndex: null,
  invoiceAmount: null,
  fundingInvoiceAmount: null,
  playerInvoiceAmount: null,
  freeMarketInvoiceAmount: null,
  customNetworkFeeInvoiceAmount: null,
  customNetworkFeeMultiplier: null,
  cumulatedFines: 0,
  voucherPaymentHash: null, // Used to check if LNURL vouchers have been successfully claimed... not useful to persist in db
  paidVoucher: false, // Used to check if LNURL vouchers have been successfully claimed... not useful to persist in db
  propertyPurchase: {},
  propertyPurchaseData: null,
  propertyUpgrade: {},
  propertyUpgradeData: null,
  propertySaleData: null,
  networkFeeInvoiceData: null,
  networkFeeInvoice: {},
  fineAmountSats: 0,
  customFineMultiplier: 0,
  rewardAmountSats: 0,
  customRewardMultiplier: 0,
  // Only stored in local storage, should we store in db so that game creator can copy/paste url in another browser
  // before game is funded?
  fundingInvoice: {
    paymentReq: null,
    paymentHash: null,
    minMax: [0, 2100000000000000],
    lnurl: null,
    units: ['sat'],
    unit: 'sat',
    data: {
      amount: null,
      memo: 'Bitcoin Difficulty: initial funding invoice'
    }
  },
  // Never stored (only created for copy/paste)
  playerInvoice: {
    qr: null,
    amount: null,
    paymentReq: null,
    paymentHash: null,
    invoiceAmount: null
  }
}

export const inviteGame = {
  ...newGame,
  imported: true,
  fundingStatus: 'success', // Game funding invoice must have been paid before players are invited
}

export const gameRecordsData = {
  columns: [
    /*
    {
      name: 'creatorId',
      required: true,
      label: 'Creator user Id',
      align: 'left',
      field: 'creatorId',
      format: val => `${val}`,
      sortable: false
    },
    {
      name: 'gameId',
      required: true,
      label: 'Game Id',
      align: 'left',
      field: 'gameId',
      format: val => `${val}`,
      sortable: false
    },
    */
    {
      name: 'dateTime',
      required: true,
      label: '',
      align: 'left',
      field: 'dateTime',
      format: val => `${val}`,
      sortable: true
    },
    {
      name: 'type',
      required: true,
      label: '',
      align: 'left',
      field: 'playerIndex',
      format: val => `${val === '0' ? 'Created' : 'Joined'}`,
      sortable: true
    },
    {
      name: 'load',
      required: true,
      label: '',
      align: 'left',
      field: '',
      format: val => `${val}`
    },
  ],
  rows: []
}

export const cameraData = {
  data: null,
  show: false,
  stream: null,
  camera: 'auto',
  deviceIndex: null,
  capabilities: {},
  candidateDevices: [],
  constraints: {},
  deviceId: "",
  error: "",
  focus: {
    enabled: true,
    min: null,
    max: null,
  },
  enableSwitchCameraButton: true,
  QRDetected: false,
  scanEnabled: false,
  closeTimeout: null
}

export const playerNames = "Satoshi Nakamoto,Nick Szabo,Hal Finney,Adam Back,Craig Wright,Michael Saylor,Jack Dorsey,Elon Musk,Nayib Bukele,Jed McCaleb,Brian Armstrong,Tyler Winklevoss,Cameron Winklevoss,Laszlo Hanyecz,Jeremy Sturdivant,Len Sassaman,Max Keizer,Stacy Herbert"