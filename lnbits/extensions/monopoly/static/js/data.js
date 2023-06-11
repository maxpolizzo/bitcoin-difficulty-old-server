// Game data templates

export const newGame = {
  started: false,
  created: false,
  imported: false,
  minFunding: 1000,
  initialFunding: "0",
  initialPlayerBalance: "0",
  showFundingView: false,
  showFundingDialog: false,
  showInviteQR: false,
  showExplanationText: true,
  showPlayerInvoiceDialog: false,
  showPropertyDialog: false,
  showPropertyInvoiceDialog: false,
  showPropertyPurchaseDialog: false,
  showPropertyUpgradeDialog: false,
  showSaleInvoiceDialog: false,
  saleInvoiceCreated: false,
  purchaseInvoiceCreated: false,
  upgradeInvoiceCreated: false,
  showNetworkFeeInvoice: false,
  fundingStatus: 'pending',
  fundingInvoiceAmount: "0",
  playerInvoiceAmount: "0",
  playerVoucherId: "",
  playerVoucher: null,
  playerVoucherAmount: 0,
  lnurlPayLinkId: "",
  lnurlPayLink: "",
  lnurlVoucherId: "",
  inviteLink: "",
  minPlayersCount: "2",
  maxPlayersCount: "6",
  playersCount: "0",
  userBalance: 0,
  bankBalance: 0,
  bankData: {},
  voucherPaymentHash: "",
  paidVoucher: false,
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
    paymentReq: null,
    paymentHash: null,
    minMax: [0, 2100000000000000],
    lnurl: null,
    units: ['sat'],
    unit: 'sat',
    data: {
      amount: null,
      memo: 'Bitcoin Monopoly: player invoice'
    }
  },
  player: {
    name: "",
    id: "",
    wallet_id: "",
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
}

export const inviteGame = {
  ...newGame,
  imported: true,
  fundingStatus: 'success', // Bank funding invoice must have been paid before players are invited
}

export const playerNames = "Satoshi Nakamoto,Nick Szabo,Hal Finney,Adam Back,Craig Wright,Michael Saylor,Jack Dorsey,Elon Musk,Nayib Bukkele,Jed McCaleb,Brian Armstrong,Tyler Winklevoss,Cameron Winklevoss,Laszlo Hanyecz,Jeremy Sturdivant,Len Sassaman,Max Keizer,Stacy Herbert"
