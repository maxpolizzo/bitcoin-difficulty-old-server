export const technology_cards = {
  "0": {
    id: 0,
    imgPath: "./static/images/lightning/cards/lightning_card_01.png",
  },
  "1": {
    id: 1,
    imgPath: "./static/images/lightning/cards/lightning_card_02.png",
  },
  "2": {
    id: 2,
    imgPath: "./static/images/lightning/cards/lightning_card_03.png",
  },
  "3": {
    id: 3,
    imgPath: "./static/images/lightning/cards/lightning_card_04.png",
  },
  "4": {
    id: 4,
    imgPath: "./static/images/lightning/cards/lightning_card_05.png",
  },
  "5": {
    id: 5,
    imgPath: "./static/images/lightning/cards/lightning_card_06.png",
  },
  "6": {
    id: 6,
    imgPath: "./static/images/lightning/cards/lightning_card_07.png"
  },
  "7": {
    id: 7,
    imgPath: "./static/images/lightning/cards/lightning_card_08.png"
  },
  "8": {
    id: 8,
    imgPath: "./static/images/lightning/cards/lightning_card_09.png",
    fineType: "pct_balance",
    fineMultiplier: 0.1,
    optionalFine: false,
    fineMessage: "Pay 10% of your current balance"
  },
  "9": {
    id: 9,
    imgPath: "./static/images/lightning/cards/lightning_card_10.png",
  },
  "10": {
    id: 10,
    imgPath: "./static/images/lightning/cards/lightning_card_11.png"
  },
  "11": {
    id: 11,
    imgPath: "./static/images/lightning/cards/lightning_card_12.png"
  },
  "12": {
    id: 12,
    imgPath: "./static/images/lightning/cards/lightning_card_13.png"
  },
  "13": {
    id: 13,
    imgPath: "./static/images/lightning/cards/lightning_card_14.png"
  },
  "14": {
    id: 14,
    imgPath: "./static/images/lightning/cards/lightning_card_15.png"
  },
  "15": {
    id: 15,
    imgPath: "./static/images/lightning/cards/lightning_card_16.png",
    fineType: "custom",
    optionalFine: true,
    fineMessage: "Skip next turn OR pay 100x the current sats/vb rate on the Bitcoin network",
    inputLabel: "Enter sats/vb value",
    fineMultiplier: 100
  },
};

export const black_swan_cards = {
  "0": {
    id: 0,
    imgPath: "./static/images/protocol/cards/protocol_card_01.png",
    rewardType: "custom",
    rewardMessage: "You found a block! Enter the current block subsidy to receive your block reward",
    inputLabel: "Enter block subsidy",
    rewardMultiplier: 200
  },
  "1": {
    id: 1,
    imgPath: "./static/images/protocol/cards/protocol_card_02.png",
    rewardType: "pct_total_liquidity",
    rewardMessage: "Receive a sats reward equal to 1% of the total game liquidity",
    rewardMultiplier: 0.01
  },
  "2": {
    id: 2,
    imgPath: "./static/images/protocol/cards/protocol_card_03.png",
    rewardType: "pct_players_balance_from_players",
    rewardMessage: "Receive a sats reward from each other player equal to 1% of their respective balance",
    rewardMultiplier: 0.01
  },
  "3": {
    id: 3,
    imgPath: "./static/images/protocol/cards/protocol_card_04.png",
    rewardType: "fixed",
    rewardAmount: 200
  },
  "4": {
    id: 4,
    imgPath: "./static/images/protocol/cards/protocol_card_05.png",
    rewardType: "pct_largest_transaction_from_players",
    rewardMessage: "Receive a sats reward from each other player equal to 10% your largest transaction so far",
    rewardMultiplier: 0.1
  },
  "5": {
    id: 5,
    imgPath: "./static/images/protocol/cards/protocol_card_06.png",
    rewardType: "pct_total_liquidity_from_players",
    rewardMessage: "Receive a sats reward from each other player equal to 1% of the total game liquidity",
    rewardMultiplier: 0.01
  },
  "6": {
    id: 6,
    imgPath: "./static/images/protocol/cards/protocol_card_07.png",
    rewardType: "fixed",
    rewardAmount: 200
  },
  "7": {
    id: 7,
    imgPath: "./static/images/protocol/cards/protocol_card_08.png",
    rewardType: "pct_total_liquidity",
    rewardMessage: "Receive a sats reward equal to 1% of the total game liquidity",
    rewardMultiplier: 0.01
  },
  "8": {
    id: 8,
    imgPath: "./static/images/protocol/cards/protocol_card_09.png",
    rewardType: "fixed",
    rewardAmount: 400
  },
  "9": {
    id: 9,
    imgPath: "./static/images/protocol/cards/protocol_card_10.png",
    fineType: "pct_balance",
    fineMultiplier: 0.1,
    optionalFine: false,
    fineMessage: "Pay 10% of your current balance"
  },
  "10": {
    id: 10,
    imgPath: "./static/images/protocol/cards/protocol_card_11.png",
    fineType: "pct_most_recent_tx_to_player",
    fineMultiplier: 0.5,
    optionalFine: false,
    fineMessage: "Pay 50% of the value of your most recent transaction to the player with the lowest balance"
  },
  "11": {
    id: 11,
    imgPath: "./static/images/protocol/cards/protocol_card_12.png",
    fineType: "pct_balance",
    fineMultiplier: 0.1,
    optionalFine: false,
    fineMessage: "Pay 10% of your current balance"
  },
  "12": {
    id: 12,
    imgPath: "./static/images/protocol/cards/protocol_card_13.png",
    fineType: "pct_balance",
    fineMultiplier: 0.1,
    optionalFine: false,
    fineMessage: "Pay 10% of your current balance"
  },
  "13": {
    id: 13,
    imgPath: "./static/images/protocol/cards/protocol_card_14.png",
  },
  "14": {
    id: 14,
    imgPath: "./static/images/protocol/cards/protocol_card_15.png",
  },
  "15": {
    id: 15,
    imgPath: "./static/images/protocol/cards/protocol_card_16.png"
  },
};
