import { newGame, playerNames, dragAndDropCardSoundURI } from './data.js'
import { claimLNURLVoucher } from './utils.js'

Vue.component(VueQrcode.name, VueQrcode)
Vue.use(VueQrcodeReader)

// Logic to check periodically if game funding invoice has been paid
function checkFundingInvoicePaid(game) {
  clearInterval(game.fundingInvoice.paymentChecker)
  game.fundingInvoice.paymentChecker = setInterval(async () => {
    await fetchFundingInvoicePaid(game)
  }, 2000)
}

async function fetchFundingInvoicePaid(game) {
  const res = await LNbits.api.getPayment(game.bankData.wallets[0], game.fundingInvoice.paymentHash);
  if(res.data) {
    if (res.data.paid) {
      console.log("Funding invoice paid!")
      clearInterval(game.fundingInvoice.paymentChecker)
      // Erase previous funding invoice
      game.fundingInvoiceAmount = 0
      game.fundingInvoice.paymentReq = null
      game.fundingInvoice = newGame.fundingInvoice
      // Save funding invoice template in local storage
      localStorage.setItem(
        'monopoly.game_' + game.bankData.id + '_' + game.player.wallets[0].id + '.fundingInvoiceAmount',
        game.fundingInvoiceAmount
      )
      localStorage.setItem(
        'monopoly.game_' + game.bankData.id + '_' + game.player.wallets[0].id + '.fundingInvoice',
        JSON.stringify(game.fundingInvoice)
      )
    } else
      await fetchBankBalance(game)
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}

// Logic to check periodically if player invoice has been paid
function checkPlayerInvoicePaid(game) {
  clearInterval(game.playerInvoice.paymentChecker)
  game.playerInvoice.paymentChecker = setInterval(async () => {
    await fetchPlayerInvoicePaid(game)
  }, 2000)
}

async function fetchPlayerInvoicePaid(game) {
  const res = await LNbits.api.getPayment(game.player.wallets[0], game.playerInvoice.paymentHash);
  if(res.data) {
    if (res.data.paid) {
      console.log("Funding invoice paid!")
      clearInterval(game.playerInvoice.paymentChecker)
      // Erase previous player invoice
      game.playerInvoiceAmount = 0
      game.playerInvoice.paymentReq = null
      game.playerInvoice = newGame.playerInvoice
      // Save player invoice template in local storage
      localStorage.setItem(
        'monopoly.game_' + game.bankData.id + '_' + game.player.wallets[0].id + '.playerInvoiceAmount',
        game.playerInvoiceAmount
      )
      localStorage.setItem(
        'monopoly.game_' + game.bankData.id + '_' + game.player.wallets[0].id + '.playerInvoice',
        JSON.stringify(game.playerInvoice)
      )
    } else
      await fetchPlayerBalance(game)
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}

// Called from index.html
async function onGameFunded (game) {
  game.showFundingDialog = false
  game.showFundingView = false
  game.fundingStatus = 'success'
  game.initialFunding = game.bankBalance
  game.initialPlayerBalance = Math.floor(game.bankBalance / 12)
  // Register initial funding and initial player balance in database
  const res = await LNbits.api
    .request(
      'PUT',
      '/monopoly/api/v1/games/funding',
      game.player.wallets[0].inkey,
      {
        bank_id: game.bankData.id,
        initial_funding: game.initialFunding,
        initial_player_balance: game.initialPlayerBalance
      }
    )
  if(res.data) {
    // Save game data into local storage
    localStorage.setItem(
      'monopoly.game_' + game.bankData.id + '_' + game.player.wallets[0].id + '.showFundingDialog',
      JSON.stringify(game.showFundingDialog)
    )
    localStorage.setItem(
      'monopoly.game_' + game.bankData.id + '_' + game.player.wallets[0].id + '.showFundingView',
      JSON.stringify(game.showFundingView)
    )
    localStorage.setItem(
      'monopoly.game_' + game.bankData.id + '_' + game.player.wallets[0].id + '.fundingStatus',
      JSON.stringify(game.fundingStatus)
    )
    localStorage.setItem(
      'monopoly.game_' + game.bankData.id + '_' + game.player.wallets[0].id + '.initialFunding',
      JSON.stringify(game.initialFunding)
    )
    localStorage.setItem(
      'monopoly.game_' + game.bankData.id + '_' + game.player.wallets[0].id + '.initialPlayerBalance',
      JSON.stringify(game.initialPlayerBalance)
    )
    console.log("Monopoly: game has been funded")
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
  // Create LNURl voucher to be claimed by players
  await createGameVoucher(game)
}

// Logic to check bank balance periodically
async function checkBankBalance(game) {
  clearInterval(game.bankBalanceChecker)
  game.bankBalanceChecker = setInterval(async () => {
    await fetchBankBalance(game)
  }, 2000)
}

async function fetchBankBalance(game) {
  const balanceBefore = game.bankBalance
  if(game.created) {
    // Game creator fetches bank balance from LNBits API and registers it in database
    let res = await LNbits.api.getWallet({
      inkey: game.bankData.wallets[0].inkey
    })
    if(res.data) {
      const bankBalance = Math.round(res.data.balance / 1000).toString()
      if(bankBalance !== balanceBefore) {
        game.bankBalance = bankBalance
        // Save bank balance in local storage
        localStorage.setItem(
          'monopoly.game_' + game.bankData.id + '_' + game.player.wallets[0].id + '.bankBalance',
          game.bankBalance.toString()
        )
        // Save bank balance in database
        res = await LNbits.api
          .request(
            'PUT',
            '/monopoly/api/v1/games/bank-balance',
            game.player.wallets[0].inkey,
            {
              bank_id: game.bankData.id,
              balance: game.bankBalance
            }
          );
        if(res.error) {
          LNbits.utils.notifyApiError(res.error)
        }
      }
    } else {
      LNbits.utils.notifyApiError(res.error)
    }
  } else if(game.imported) {
    // Invited players fetch bank balance from database
    let res = await LNbits.api
      .request(
        'GET',
        '/monopoly/api/v1/bank-balance?bank_id=' + game.bankData.id,
        game.player.wallets[0].inkey,
      )
    if(res.data) {
      const bankBalance = res.data[0][1]
      if(bankBalance !== balanceBefore) {
        game.bankBalance = bankBalance
        // Save bank balance in local storage
        localStorage.setItem(
          'monopoly.game_' + game.bankData.id + '_' + game.player.wallets[0].id + '.bankBalance',
          game.bankBalance.toString()
        )
      }
    } else {
      LNbits.utils.notifyApiError(res.error)
    }
  }
}

// Logic to create LNURl voucher from bank wallet, to be claimed by players
async function createGameVoucher(game) {
  const voucherData = {
    custom_url: null,
    is_unique: false,
    max_withdrawable: game.initialPlayerBalance,
    min_withdrawable: game.initialPlayerBalance,
    title: "Monopoly game voucher",
    use_custom: false,
    wait_time: 1,
    uses: game.maxPlayersCount // Maximum number of players to be invited via voucher (including game creator)
  }
  // Create LNURL withdraw link
  let res = await LNbits.api
    .request('POST', '/withdraw/api/v1/links', game.bankData.wallets[0].adminkey, voucherData);
  if(res.data) {
    const voucherId = res.data.id
    const voucher = res.data.lnurl
    // Register LNURL withdraw link Id in database
    res = await LNbits.api
      .request(
        'POST',
        '/monopoly/api/v1/games/voucher',
        game.player.wallets[0].inkey,
        {
          bank_id: game.bankData.id,
          voucher_id: voucherId
        }
      )
    if(res.data) {
      console.log("Monopoly: LNURL voucher created successfully")
      // Save lnurl voucher Id in local storage
      game.lnurlVoucherId = voucherId;
      localStorage.setItem(
        'monopoly.game_' + game.bankData.id + '_' + game.player.wallets[0].id + '.lnurlVoucherId',
        game.lnurlVoucherId.toString()
      )
      // Claim LNURL voucher for game creator
      await claimLNURLVoucher(voucher, game.player.wallets[0]);
      // Refresh page to refresh game creator's player wallet balance in left panel
      window.location.reload();
    } else {
      LNbits.utils.notifyApiError(res.error)
    }
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}

// Logic to check periodically if game has been started by creator
async function checkGameStarted(game) {
  clearInterval(game.gameStartedChecker)
  game.gameStartedChecker = setInterval(async () => {
    await fetchGameStarted(game)
  }, 2000)
}

async function fetchGameStarted(game) {
  let res = await LNbits.api
    .request(
      'GET',
      '/monopoly/api/v1/game-started?bank_id=' + game.bankData.id,
      game.player.wallets[0].inkey,
    )
  if(res.data) {
    game.started = res.data[0][1]
    // Save game status in local storage
    localStorage.setItem(
      'monopoly.game_' + game.bankData.id + '_' + game.player.wallets[0].id + '.started',
      game.started.toString()
    )
    if(game.started) {
      // Clear interval
      clearInterval(game.gameStartedChecker)
      console.log("GAME STARTED")
    }
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}

// Logic to check periodically for new players joining the game
async function checkPlayers(game) {
  clearInterval(game.playersChecker) // Interval should be cleared again when game starts
  game.playersChecker = setInterval(async () => {
    await fetchPlayers(game)
  }, 2000)
}

async function fetchPlayers(game) {
  let res = await LNbits.api
    .request(
      'GET',
      '/monopoly/api/v1/players?bank_id=' + game.bankData.id,
      game.player.wallets[0].inkey
    )
  if(res.data) {
    let playersCount = 0
    res.data.forEach((player) => {
      playersCount += 1;
      if(!game.players[player.player_wallet_id]){
        game.players[player.player_wallet_id] = player
        game.playersData.rows.push(
          {
            name: player.player_wallet_name,
            balance: 0
          }
        )
      }
    })
    if(playersCount !== game.playersCount) {
      game.playersCount = playersCount
      // Save game data in  local storage
      localStorage.setItem(
        'monopoly.game_' + game.bankData.id + '_' + game.player.wallets[0].id + '.playersCount',
        game.playersCount
      )
      localStorage.setItem(
        'monopoly.game_' + game.bankData.id + '_' + game.player.wallets[0].id + '.players',
        JSON.stringify(game.players)
      )
      localStorage.setItem(
        'monopoly.game_' + game.bankData.id + '_' + game.player.wallets[0].id + '.playersData',
        JSON.stringify(game.playersData)
      )
    }
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}

// Logic to check player balance periodically
async function checkPlayerBalance(game) {
  clearInterval(game.userBalanceChecker)
  game.userBalanceChecker = setInterval(async () => {
    await fetchPlayerBalance(game)
  }, 2000)
}

async function fetchPlayerBalance(game) {
  const balanceBefore = game.userBalance
  let res = await LNbits.api.getWallet({
    inkey: game.player.wallets[0].inkey
  })
  if(res.data) {
    const userBalance = Math.round(res.data.balance / 1000).toString()
    if(userBalance !== balanceBefore) {
      game.userBalance = userBalance
      // Save user balance in local storage
      localStorage.setItem(
        'monopoly.game_' + game.bankData.id + '_' + game.player.wallets[0].id + '.userBalance',
        game.userBalance.toString()
      )
      // Save user balance in database
      res = await LNbits.api
        .request(
          'PUT',
          '/monopoly/api/v1/players/balance',
          game.player.wallets[0].inkey,
          {
            player_wallet_id: game.player.wallets[0].id,
            player_balance: game.userBalance
          }
        );
      if(res.error) {
        LNbits.utils.notifyApiError(res.error)
      }
    }
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}

// Logic to check other players balances periodically
async function checkPlayersBalances(game) {
  clearInterval(game.playersBalancesChecker)
  game.playersBalancesChecker = setInterval(async () => {
    await fetchPlayersBalances(game)
  }, 2000)
}

async function fetchPlayersBalances(game) {
  // Fetch players from database
  let res = await LNbits.api
    .request(
      'GET',
      '/monopoly/api/v1/players?bank_id=' + game.bankData.id,
      game.player.wallets[0].inkey
    )
  if(res.data) {
    let balanceChanged = false;
    res.data.forEach((player) => {
      if(game.players[player.player_wallet_id]) {
        if(game.players[player.player_wallet_id].player_balance !== player.player_balance) {
          balanceChanged = true
          game.players[player.player_wallet_id].player_balance = player.player_balance
        }
        for(let i = 0; i < game.playersData.rows.length; i++) {
          if(
            game.playersData.rows[i].name === player.player_wallet_name
            &&  game.playersData.rows[i].balance !== player.player_balance
          ) {
            balanceChanged = true
            game.playersData.rows[i].balance = player.player_balance
          }
        }
      }
    })
    if(balanceChanged) {
      // Save game data in  local storage
      localStorage.setItem(
        'monopoly.game_' + game.bankData.id + '_' + game.player.wallets[0].id + '.players',
        JSON.stringify(game.players)
      )
      localStorage.setItem(
        'monopoly.game_' + game.bankData.id + '_' + game.player.wallets[0].id + '.playersData',
        JSON.stringify(game.playersData)
      )
    }
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}

// Logic to delete game voucher once game starts
async function deleteGameVoucher(game) {
  if(game.lnurlVoucherId) {
    console.log("Deleting LNURL voucher " + game.lnurlVoucherId)
    // Delete LNURL withdraw link
    let res = await LNbits.api
      .request('DELETE', '/withdraw/api/v1/links/' + game.lnurlVoucherId, game.bankData.wallets[0].adminkey);
    if(res.data.success) {
      game.lnurlVoucherId = null
      game.lnurlVoucher = null
      // Save game data to local storage
      localStorage.setItem(
        'monopoly.game_' + game.bankData.id + '_' + game.player.wallets[0].id + '.lnurlVoucherId',
        game.lnurlVoucherId
      )
      localStorage.setItem(
        'monopoly.game_' + game.bankData.id + '_' + game.player.wallets[0].id + '.lnurlVoucher',
        game.lnurlVoucher
      )
      console.log("LNURL voucher deleted successfully")
    } else {
      LNbits.utils.notifyApiError(res.error)
    }
  }
}

function beep() {
  // Convert mp3 or wav files into Data URI format: https://dopiaza.org/tools/datauri/index.php
  const snd = new Audio(dragAndDropCardSoundURI);
  snd.play();
}

// Logic executed when page loads
//
// Initialise game data with template
let game = newGame
// Check local storage for existing games
let existingGameRecords = JSON.parse(localStorage.getItem('monopoly.gameRecords'))
if(existingGameRecords && existingGameRecords.length) {
  for(let i = 0; i < window.user.wallets.length; i++) {
    let userWalletId = window.user.wallets[i].id
    let gameRecord
    for(let j = 0; j < existingGameRecords.length; j++) {
      if(existingGameRecords[j].split('_')[2] === userWalletId) {
        gameRecord = existingGameRecords[j]
        break
      }
    }
    if(gameRecord) {
      // Update game object with values found in local storage
      Object.keys(game).forEach((key) => {
        try {
          game[key] = JSON.parse(localStorage.getItem('monopoly.' + gameRecord + '.' + key))
        } catch(err) {
          game[key] = localStorage.getItem('monopoly.' + gameRecord + '.' + key)
        }
      })
      break;
    }
  }
}

new Vue({
  el: '#vue',
  mixins: [windowMixin],
  computed: {
    // Reactive components styling (for some reason using media-queries in monopoly.css does not work)
    reactiveStyle () {
      if(window.innerWidth > 768) {
        // For desktop
        return {
          cardsStack: {
            height: `25em`
          },
          card: (card) => {
            let cardPosition;
            this.game.properties[game.player.id][card.color].forEach((_card) => {
              if(_card.id === card.id) {
                cardPosition = _card.position;
              }
            });
            return({
              position: `absolute`,
              zIndex: parseInt(cardPosition) + 2,
              marginTop: (3 * (parseInt(cardPosition) + 1)).toString() + `em`
            })
          },
          propertyImage: {
            height: `auto`,
            maxWidth: `65%`,
            marginTop: `1em`,
            marginLeft: `6em`
          },
          propertyButtons: {
            div: {
              marginTop: `1em`
            },
            buyButton: {
              marginLeft: `12em`
            },
            invoiceButton: {
              marginLeft: `2.5em`
            },
            upgradeButton: {
              marginLeft: `1em`
            },
            sellButton: {
              marginLeft: `12em`
            },
            offerButton: {
              marginLeft: `13em`
            },
          },
          propertyButtonsForGameCreator: {
            div: {
              marginTop: `1em`
            },
            invoicePurchaseButton: {
              marginLeft: `8em`
            },
            invoiceUpgradeButton: {
              marginLeft: `6.5em`
            },
          },
        }
      } else {
        return {
          cardsStack: {
            height: `12em`
          },
          card: (card) => {
            let cardPosition;
            this.game.properties[game.player.id][card.color].forEach((_card) => {
              if(_card.id === card.id) {
                cardPosition = _card.position;
              }
            });
            return({
              position: `absolute`,
              zIndex: parseInt(cardPosition) + 2,
              marginTop: (1.6 * (parseInt(cardPosition) + 1)).toString() + `em`
            })
          },
          propertyImage: {
            height: `auto`,
            maxWidth: `85%`,
            marginTop: `2em`,
            marginLeft: `2em`
          },
          propertyButtons: {
            div: {
              marginTop: `1em`
            },
            buyButton: {
              marginLeft: `7.5em`
            },
            invoiceButton: {
              marginLeft: `5.5em`
            },
            upgradeButton: {
              marginLeft: `4.5em`
            },
            sellButton: {
              marginLeft: `7.25em`
            },
            offerButton: {
              marginLeft: `8em`
            },
          },
          propertyButtonsForGameCreator: {
            div: {
              marginTop: `1em`
            },
            invoicePurchaseButton: {
              marginLeft: `3.5em`
            },
            invoiceUpgradeButton: {
              marginLeft: `2.5em`
            },
          },
        }
      }
    },
    // Draggable cards options
    dragOptions() {
      return {
        animation: 0,
        group: "{ name: 'cards', pull: 'false', put: true }",
        disabled: false,
        ghostClass: "ghost"
      };
    },
  },
  watch: {
    // Draggable cards
    isDragging(newValue) {
      if (newValue) {
        this.delayedDragging = true;
        return;
      }
      this.$nextTick(() => {
        this.delayedDragging = false;
      });
    }
  },
  data: function () {
    // Start checking bank balance
    fetchBankBalance(game).then(() => {
      // If game has already been created or imported, fetch user balance, other
      // players and start checking periodically for game being started by creator
      if(game.created || game.imported) {
        fetchPlayerBalance(game).then(() => {
          fetchPlayers(game).then(() => {
            checkPlayersBalances(game).then(() => {
              console.log("Periodically fetching other players balances from database...")
            })
          })
        })
        checkPlayers(game).then(() => {
          console.log("Periodically checking for new players...")
        })
        checkPlayerBalance(game).then(() => {
          console.log("Periodically checking player balance...")
        })
      }
      checkBankBalance(game).then(() => {
        console.log("Periodically checking bank balance...")
      })
      if(game.created) {
        fetchGameStarted(game).then()
      } else if(game.imported) {
        checkGameStarted(game).then(() => {
          console.log("Periodically checking if game creator started the game...")
        })
      }
    })

    // Hack to copy command to pay invoice from local node
    game.payInvoiceCommand = "lncli -n regtest --lnddir=\"/Users/maximesuard/Dev/Perso/Bitcoin/lnd-regtest-2\" --rpcserver=localhost:11009 payinvoice "

    // Hack to display dummy properties
    game.properties[game.player.id] = {};
    game.properties[game.player.id]["red"] = [
      { color: "red", id: 0, imgPath: "./static/images/properties/cards/p00.png", position: 0, owner: game.player.id },
      { color: "red", id: 1, imgPath: "./static/images/properties/cards/p01.png", position: 1, owner: null },
      { color: "red", id: 2, imgPath: "./static/images/properties/cards/p02.png", position: 2, owner: null },
      { color: "red", id: 3, imgPath: "./static/images/properties/cards/p03.png", position: 3, owner: null },
    ];
    game.properties[game.player.id]["light-blue"] = [
      { color: "light-blue", id: 0, imgPath: "./static/images/properties/cards/p00.png", position: 0, owner: "otherPlayer" },
    ];
    game.properties[game.player.id]["yellow"] = [
      { color: "yellow", id: 0, imgPath: "./static/images/properties/cards/p00.png", position: 0, owner: null },
      { color: "yellow", id: 1, imgPath: "./static/images/properties/cards/p01.png", position: 1, owner: null },
    ];
    game.properties[game.player.id]["orange"] = [
      { color: "orange", id: 0, imgPath: "./static/images/properties/cards/p00.png", position: 0, owner: null },
      { color: "orange", id: 1, imgPath: "./static/images/properties/cards/p01.png", position: 1, owner: null },
      { color: "orange", id: 2, imgPath: "./static/images/properties/cards/p02.png", position: 2, owner: null },
    ];
    game.properties[game.player.id]["deep-blue"] = [
      { color: "deep-blue", id: 0, imgPath: "./static/images/properties/cards/p00.png", position: 0, owner: null },
      { color: "deep-blue", id: 1, imgPath: "./static/images/properties/cards/p01.png", position: 1, owner: null },
    ];
    game.propertiesCount[game.player.id] = 12;

    return {
      game: game,
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
  methods: {
    // Method for draggable cards
    onMove: function({ relatedContext, draggedContext }) {
      const relatedElement = relatedContext.element;
      const draggedElement = draggedContext.element;
      // Only enable dragging on same color stack
      const doDrag = (
        draggedElement && draggedElement.color
        && relatedElement && relatedElement.color
        && (draggedElement.color === relatedElement.color)
        && (draggedElement.id !== relatedElement.id)
      ) === true;
      return doDrag;
    },
    onStartDrag: function() {
      this.isDragging = true;
      this.dragStartTime = Date.now();
    },
    onDragged: function({ oldIndex, newIndex }, color) {
      this.isDragging = false;
      // Update cards positions in the stack
      let draggedElement;
      this.game.properties[this.game.player.id][color].forEach((card) => {
        if(card.position === oldIndex) {
          draggedElement = card;
        }
      })
      // Dragged element position becomes newIndex
      for(let i = 0; i < this.game.properties[this.game.player.id][color].length; i++) {
        if(this.game.properties[this.game.player.id][color][i].id === draggedElement.id) {
          this.game.properties[this.game.player.id][color][i].position = newIndex;
          this.draggedProperty = this.game.properties[this.game.player.id][color][i];
        }
      }
      // Other cards positions are moved by 1 up or down
      if(newIndex > oldIndex) {
        // Cards between oldIndex and newIndex have their position reduced by
        // one, including related element
        for(let i = 0; i < this.game.properties[this.game.player.id][color].length; i++) {
          if(
            this.game.properties[this.game.player.id][color][i].position <= newIndex
            && this.game.properties[this.game.player.id][color][i].position > oldIndex
            && this.game.properties[this.game.player.id][color][i].id !== draggedElement.id
          ) {
            this.game.properties[this.game.player.id][color][i].position -= 1;
          }
        }
      } else {
        // Cards between newIndex and oldIndex have their position increased by
        // one, including related element
        for(let i = 0; i < this.game.properties[this.game.player.id][color].length; i++) {
          if(
            this.game.properties[this.game.player.id][color][i].position >= newIndex
            && this.game.properties[this.game.player.id][color][i].position < oldIndex
            && this.game.properties[this.game.player.id][color][i].id !== draggedElement.id
          ) {
            this.game.properties[this.game.player.id][color][i].position += 1;
          }
        }
      }
      if(newIndex !== oldIndex) {
        // Emit sound
        beep();
      } else if (Date.now() - this.dragStartTime < 100) {
        // If property position was not changed and drag time is below 150ms,
        // treat event as if it was a click on the property card (otherwise
        // mobile taps are seen as drags)
        this.showPropertyDetails(this.draggedProperty);
      }
    },
    // Logic to create a new game and a dedicated wallet for game creator (called from index.html)
    createGame: async function () {
      // Create bank wallet and dedicated player wallet for game creator
      await this.createBankAndPlayerWallet();
      // Create a static LNURL pay link to be used for funding bank
      await this.createBankPayLNURL();
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
    createFundingInvoice: async function () {
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
          this.checkFundingInvoicePaid()
        } else {
          LNbits.utils.notifyApiError(res.error)
        }
      } else  {
        LNbits.utils.notifyApiError(res.error)
        this.game.fundingStatus = 'error'
      }
    },
    // Logic to create an invoice for player to request funds
    createPlayerInvoice: async function () {
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
          this.checkPlayerInvoicePaid()
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
    checkFundingInvoicePaid: function () {
      checkFundingInvoicePaid(this.game)
    },
    checkPlayerInvoicePaid: function () {
      checkPlayerInvoicePaid(this.game)
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
    closePropertyDialog: function () {
      this.game.showPropertyDialog = false;
      this.game.propertyToShow = {};
    },
    createNetworkFeeInvoice: async function (property) {
      this.erasePropertyInvoices()

      this.game.playerInvoiceAmount = 100; // Figure out how to calculate this amount
      await this.createPlayerInvoice();
      this.game.showPropertyDialog = false;
      this.game.networkFeeInvoice = true;
      this.game.showPropertyInvoiceDialog = true;
    },
    createSellInvoice: async function (property) {
      this.erasePropertyInvoices()
      this.game.showPropertyDialog = false;
      this.game.sellInvoice = true;
      this.game.showPropertyInvoiceDialog = true;
    },
    createUpgradeInvoice: async function (property) {
      this.erasePropertyInvoices()
      this.game.fundingInvoiceAmount = 30; // Figure out how to calculate this amount
      await this.createFundingInvoice();
      this.game.showPropertyDialog = false;
      this.game.upgradeInvoice = true;
      this.game.showPropertyInvoiceDialog = true;
    },
    createPurchaseInvoice: async function (property) {
      this.erasePropertyInvoices()
      this.game.fundingInvoiceAmount = 300; // Figure out how to calculate this amount
      await this.createFundingInvoice();
      this.game.showPropertyDialog = false;
      this.game.purchaseInvoice = true;
      this.game.showPropertyInvoiceDialog = true;
    },
    createOfferVoucher: async function (property) {
      this.erasePropertyInvoices()
      this.game.showPropertyDialog = false;
      this.game.offerVoucher = true;
      this.game.showPropertyInvoiceDialog = true;
    },
    closePropertyInvoiceDialog: function () {
      this.erasePropertyInvoices()
      this.game.showPropertyInvoiceDialog = false;
      this.game.showPropertyDialog = true;
    },
    erasePropertyInvoices: function() {
      this.game.playerInvoice.paymentReq = null;
      this.game.playerInvoice = newGame.playerInvoice;
      this.game.fundingInvoice.paymentReq = null;
      this.game.fundingInvoice = newGame.fundingInvoice;
      this.game.playerVoucherId = null;
      this.game.playerVoucher = null;
      this.game.networkFeeInvoice = false;
      this.game.sellInvoice = false;
      this.game.upgradeInvoice = false;
      this.game.purchaseInvoice = false;
      this.game.offerVoucher = false;
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
    /*
    parseQRData: async function (QRData) {
      let data = JSON.parse(QRData)
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
    },
    */
  }
})