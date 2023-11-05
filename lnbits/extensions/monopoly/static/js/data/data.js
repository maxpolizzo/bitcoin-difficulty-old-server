// Game data templates

export const newGame = {
  started: false,
  created: false,
  imported: false,
  joined: false,
  timestamp: null,
  minFunding: 20000,
  startClaimAmount: 200,
  initialFunding: "0",
  initialPlayerBalance: "0",
  playerTurn: 0,
  showFundingView: false,
  showFundingDialog: false,
  showInviteQR: false,
  showExplanationText: false,
  showPayInvoiceDialog: false,
  showPlayerInvoiceDialog: false,
  showFreeMarketInvoiceDialog: false,
  showPropertyDialog: false,
  showPropertyInvoiceDialog: false,
  showPropertyPurchaseDialog: false,
  showPropertyUpgradeDialog: false,
  showSaleInvoiceDialog: false,
  showFreeBitcoinClaimDialog: false,
  showStartClaimDialog: false,
  showLightningCard: false,
  showProtocolCard: false,
  lightningCardToShow: "",
  protocolCardToShow: "",
  fistLightningCardThisTurn: true,
  fistProtocolCardThisTurn: true,
  showNotYourTurnPopUp: false,
  showNetworkFeeInvoiceDialog: false,
  saleInvoiceCreated: false,
  purchaseInvoiceCreated: false,
  upgradeInvoiceCreated: false,
  showNetworkFeeInvoice: false,
  fundingStatus: 'pending',
  invoice: null,
  invoiceRecipientIndex: null,
  invoiceAmount: "0",
  fundingInvoiceAmount: "0",
  playerInvoiceAmount: "0",
  freeMarketInvoiceAmount: "0",
  customNetworkFeeInvoiceAmount: null,
  customNetworkFeeMultiplier: null,
  playerVoucherId: "",
  playerVoucher: null,
  playerVoucherAmount: 0,
  lnurlPayLinkId: "",
  lnurlPayLink: "",
  playerPayLinkCreated: false,
  inviteVoucherId: "",
  rewardVoucherId: "",
  rewardVoucher: "",
  inviteLink: "",
  minPlayersCount: "2",
  maxPlayersCount: "6",
  playersCount: "0",
  userBalance: 0,
  marketLiquidity: 0,
  marketData: {},
  voucherPaymentHash: "",
  paidVoucher: false,
  cumulatedFines: 0,
  fundingInvoice: {
    paymentReq: null,
    paymentHash: null,
    minMax: [0, 2100000000000000],
    lnurl: null,
    units: ['sat'],
    unit: 'sat',
    data: {
      amount: null,
      memo: 'Bitcoin Monopoly: initial funding invoice'
    }
  },
  playerInvoice: {
    qr: null,
    amount: null
  },
  freeMarketInvoice: {
    qr: null,
    amount: null
  },
  freeMarketWallet: {
    payments: {}
  },
  playerWallet: {
    payments: {}
  },
  player: {
    index: "", // Monopoly database player index
    name: "", // Monopoly database player name
    id: "", // LNBits user_id
    wallet_id: "", // LNBits wallet_id
    wallets: []
  },
  players: {},
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
        align: 'left',
        field: 'balance',
        format: val => `${val}`,
        sortable: true
      },
    ],
    rows: []
  },
  properties: {},
  propertiesCount: {},
  propertyToShow: {},
  propertyPurchase: {},
  propertyPurchaseData: null,
  propertyUpgrade: {},
  propertyUpgradeData: null,
  propertySaleData: null,
  networkFeeInvoiceData: null,
  networkFeeInvoice: {},
  gameCreatorPaymentToMarket: false,
  fineAmountSats: 0,
  customFineMultiplier: 0,
  rewardAmountSats: 0,
  customRewardMultiplier: 0,
  // Hack to copy command to pay invoice from local node
  payInvoiceCommand: "lncli -n regtest --lnddir=\"/Users/maximesuard/Dev/Perso/Bitcoin/lnd-regtest-2\" --rpcserver=localhost:11009 payinvoice "

}

export const inviteGame = {
  ...newGame,
  imported: true,
  fundingStatus: 'success', // Game funding invoice must have been paid before players are invited
}

export const gameRecordsData = {
  columns: [
    {
      name: 'Game Id',
      required: true,
      label: 'Game Id',
      align: 'left',
      field: 'gameId',
      format: val => `${val}`,
      sortable: false
    },
    /*
    {
      name: 'Creator wallet Id',
      required: true,
      label: 'Creator Id',
      align: 'left',
      field: 'creatorId',
      format: val => `${val}`,
      sortable: false
    },
    */
    {
      name: 'dateCreated',
      required: true,
      label: 'Date created',
      align: 'left',
      field: 'dateTime',
      format: val => `${val}`,
      sortable: true
    },
    {
      name: 'link',
      required: true,
      label: 'Load game',
      align: 'left',
      field: 'link',
      format: val => `${val}`
    },
  ],
  rows: []
}

export const playerNames = "Satoshi Nakamoto,Nick Szabo,Hal Finney,Adam Back,Craig Wright,Michael Saylor,Jack Dorsey,Elon Musk,Nayib Bukele,Jed McCaleb,Brian Armstrong,Tyler Winklevoss,Cameron Winklevoss,Laszlo Hanyecz,Jeremy Sturdivant,Len Sassaman,Max Keizer,Stacy Herbert"
