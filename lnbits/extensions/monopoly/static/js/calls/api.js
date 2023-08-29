import { newGame } from '../data/data.js'
import { claimInviteVoucher } from '../helpers/utils.js'
import {
  playPlayerPaymentReceivedSound,
  playMarketPaymentReceivedSound
} from '../helpers/audio.js'

export async function fetchPaymentsToFreeMarket(game) {
  const res = await LNbits.api.getPayments(game.marketData.wallets[0]);

  if(res.data) {
    const payments = res.data
      .map(obj => {
        return LNbits.map.payment(obj)
      })
      .sort((a, b) => {
        return b.time - a.time
      })
    payments.forEach((payment) => {
      if(game.freeMarketWallet.payments[payment.payment_hash]) {
        if(game.freeMarketWallet.payments[payment.payment_hash].pending && !payment.pending) {
          game.freeMarketWallet.payments[payment.payment_hash].pending = false
          if(payment.isIn) {
            console.log("Free market wallet received a payment")
            // Play sound
            playMarketPaymentReceivedSound()
          } else  {
            console.log("Free market wallet sent a payment")
          }
        }
      } else {
        if(payment.pending) {
          game.freeMarketWallet.payments[payment.payment_hash] = {
            pending: true
          }
        } else {
          game.freeMarketWallet.payments[payment.payment_hash] = {
            pending: false
          }
          if(payment.isIn) {
            console.log("Free market wallet received a payment")
            // Play sound
            playMarketPaymentReceivedSound()
          } else  {
            console.log("Free market wallet sent a payment")
          }
        }
      }
    })
    // Save payments to free market in local storage
    localStorage.setItem(
      'monopoly.game_' + game.marketData.id + '_' + game.player.id + '_' + game.player.wallet_id + '.freeMarketWallet',
      JSON.stringify(game.freeMarketWallet)
    )
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}

export async function fetchPaymentsToPlayer(game) {
  const res = await LNbits.api.getPayments(game.player.wallets[0]);

  if(res.data) {
    const payments = res.data
      .map(obj => {
        return LNbits.map.payment(obj)
      })
      .sort((a, b) => {
        return b.time - a.time
      })
    payments.forEach((payment) => {
      if(game.playerWallet.payments[payment.payment_hash]) {
        if(game.playerWallet.payments[payment.payment_hash].pending && !payment.pending) {
          game.playerWallet.payments[payment.payment_hash].pending = false
          if(payment.isIn) {
            console.log("Player wallet received a payment")
            // Play sound
            playPlayerPaymentReceivedSound()
          } else  {
            console.log("Player wallet sent a payment")
          }
        }
      } else {
        if(payment.pending) {
          game.playerWallet.payments[payment.payment_hash] = {
            pending: true
          }
        } else {
          game.playerWallet.payments[payment.payment_hash] = {
            pending: false
          }
          if(payment.isIn) {
            console.log("Player wallet received a payment")
            // Play sound
            playPlayerPaymentReceivedSound()
          } else  {
            console.log("Player wallet sent a payment")
          }
        }
      }
    })
    // Save payments to player in local storage
    localStorage.setItem(
      'monopoly.game_' + game.marketData.id + '_' + game.player.id + '_' + game.player.wallet_id + '.playerWallet',
      JSON.stringify(game.playerWallet)
    )
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}

export async function fetchFundingInvoicePaid(game, invoiceReason = null) {
  const res = await LNbits.api.getPayment(game.marketData.wallets[0], game.fundingInvoice.paymentHash);
  if(res.data) {
    if (res.data.paid) {
      console.log("Funding invoice paid!")
      // Clear payment checker interval
      clearInterval(game.fundingInvoice.paymentChecker)
      // Erase previous funding invoice
      game.fundingInvoiceAmount = 0
      game.fundingInvoice.paymentReq = null
      game.fundingInvoice = newGame.fundingInvoice
      // Save funding invoice template in local storage
      localStorage.setItem(
        'monopoly.game_' + game.marketData.id + '_' + game.player.id + '_' + game.player.wallet_id + '.fundingInvoiceAmount',
        game.fundingInvoiceAmount
      )
      localStorage.setItem(
        'monopoly.game_' + game.marketData.id + '_' + game.player.id + '_' + game.player.wallet_id + '.fundingInvoice',
        JSON.stringify(game.fundingInvoice)
      )
      /*
      if(invoiceReason) {
        console.log(invoiceReason)
        switch(invoiceReason.type) {
          case "property_upgrade":
          // update property's mining capacity
          default:
            console.warn("Unknown invoice reason: " + invoiceReason.type)
        }
      }
      */
    } else
      await fetchMarketLiquidity(game)
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}

export async function fetchPlayerInvoicePaid(game, invoiceReason = null) {
  const res = await LNbits.api.getPayment(game.player.wallets[0], game.playerInvoice.paymentHash);
  if(res.data) {
    if (res.data.paid) {
      console.log("Player invoice paid!")
      // Clear payment checker interval
      clearInterval(game.playerInvoice.paymentChecker)
      // Erase previous player invoice
      game.playerInvoiceAmount = 0
      game.playerInvoice.paymentReq = null
      game.playerInvoice = newGame.playerInvoice
      // Save player invoice template in local storage
      localStorage.setItem(
        'monopoly.game_' + game.marketData.id + '_' + game.player.id + '_' + game.player.wallet_id + '.playerInvoiceAmount',
        game.playerInvoiceAmount
      )
      localStorage.setItem(
        'monopoly.game_' + game.marketData.id + '_' + game.player.id + '_' + game.player.wallet_id + '.playerInvoice',
        JSON.stringify(game.playerInvoice)
      )
    } else
      await fetchPlayerBalance(game)
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}

export async function fetchFreeMarketInvoicePaid(game, invoiceReason = null) {
  const res = await LNbits.api.getPayment(game.marketData.wallets[0], game.freeMarketInvoice.paymentHash);
  if(res.data) {
    if (res.data.paid) {
      console.log("Free market invoice paid!")
      // Clear payment checker interval
      clearInterval(game.freeMarketInvoice.paymentChecker)
      // Erase previous player invoice
      game.freeMarketInvoiceAmount = 0
      game.freeMarketInvoice.paymentReq = null
      game.freeMarketInvoice = newGame.freeMarketInvoice
      // Save player invoice template in local storage
      localStorage.setItem(
        'monopoly.game_' + game.marketData.id + '_' + game.player.id + '_' + game.player.wallet_id + '.freeMarketInvoiceAmount',
        game.freeMarketInvoiceAmount
      )
      localStorage.setItem(
        'monopoly.game_' + game.marketData.id + '_' + game.player.id + '_' + game.player.wallet_id + '.freeMarketInvoice',
        JSON.stringify(game.freeMarketInvoice)
      )
    } else
      await fetchMarketLiquidity(game)
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}

export async function fetchPlayerBalance(game) {
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
        'monopoly.game_' + game.marketData.id + '_' + game.player.id + '_' + game.player.wallet_id + '.userBalance',
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

export async function fetchMarketLiquidity(game) {
  const liquidityBefore = game.marketLiquidity
  if(game.created) {
    // Game creator fetches game funding balance from LNBits API and registers it in database
    let res = await LNbits.api.getWallet({
      inkey: game.marketData.wallets[0].inkey
    })
    if(res.data) {
      const marketLiquidity = Math.round(res.data.balance / 1000).toString()
      if(marketLiquidity !== liquidityBefore) {
        game.marketLiquidity = marketLiquidity
        // Save game funding balance in local storage
        localStorage.setItem(
          'monopoly.game_' + game.marketData.id + '_' + game.player.id + '_' + game.player.wallet_id + '.marketLiquidity',
          game.marketLiquidity.toString()
        )
        // Save game funding balance in database
        res = await LNbits.api
          .request(
            'PUT',
            '/monopoly/api/v1/games/market-liquidity',
            game.player.wallets[0].inkey,
            {
              game_id: game.marketData.id,
              balance: game.marketLiquidity
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
    // Invited players fetch game funding balance from database
    let res = await LNbits.api
      .request(
        'GET',
        '/monopoly/api/v1/market-liquidity?game_id=' + game.marketData.id,
        game.player.wallets[0].inkey,
      )
    if(res.data) {
      const marketLiquidity = res.data[0][1]
      if(marketLiquidity !== liquidityBefore) {
        game.marketLiquidity = marketLiquidity
        // Save game funding balance in local storage
        localStorage.setItem(
          'monopoly.game_' + game.marketData.id + '_' + game.player.id + '_' + game.player.wallet_id + '.marketLiquidity',
          game.marketLiquidity.toString()
        )
      }
    } else {
      LNbits.utils.notifyApiError(res.error)
    }
  }
}

export async function createGameVouchers(game) {
  await createRewardVoucher(game)
  await createInviteVoucher(game)
}

// Logic to create LNURl voucher from game funding wallet, to be claimed for players rewards
export async function createRewardVoucher(game) {
  // Create rewards voucher
  const voucherData = {
    custom_url: null,
    is_unique: false,
    max_withdrawable: game.initialFunding,
    min_withdrawable: 1,
    title: "Monopoly rewards voucher",
    use_custom: false,
    wait_time: 1,
    uses: 250 // max number of uses allowed by the withdraw extension
  }
  // Create LNURL withdraw link
  let res = await LNbits.api
    .request('POST', '/withdraw/api/v1/links', game.marketData.wallets[0].adminkey, voucherData);
  if(res.data) {
    const voucherId = res.data.id
    const voucher = res.data.lnurl
    // Register LNURL withdraw link Id in database
    res = await LNbits.api
      .request(
        'POST',
        '/monopoly/api/v1/games/reward_voucher',
        game.player.wallets[0].inkey,
        {
          game_id: game.marketData.id,
          voucher_id: voucherId
        }
      )
    if(res.data) {
      console.log("Monopoly: reward voucher created successfully")
      // Save lnurl voucher Id in local storage
      game.rewardVoucherId = voucherId;
      localStorage.setItem(
        'monopoly.game_' + game.marketData.id + '_' + game.player.id + '_' + game.player.wallet_id + '.rewardVoucherId',
        game.rewardVoucherId.toString()
      )
      // Save lnurl voucher in local storage
      game.rewardVoucher = voucher;
      localStorage.setItem(
        'monopoly.game_' + game.marketData.id + '_' + game.player.id + '_' + game.player.wallet_id + '.rewardVoucher',
        game.rewardVoucher.toString()
      )
    } else {
      LNbits.utils.notifyApiError(res.error)
    }
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}

// Logic to create LNURl voucher from game funding wallet, to be claimed by invited players
export async function createInviteVoucher(game) {
  // Creat invite voucher
  const voucherData = {
    custom_url: null,
    is_unique: false,
    max_withdrawable: game.initialPlayerBalance,
    min_withdrawable: game.initialPlayerBalance,
    title: "Monopoly invite voucher",
    use_custom: false,
    wait_time: 1,
    uses: game.maxPlayersCount // Maximum number of players to be invited via voucher (including game creator)
  }
  // Create LNURL withdraw link
  let res = await LNbits.api
    .request('POST', '/withdraw/api/v1/links', game.marketData.wallets[0].adminkey, voucherData);
  if(res.data) {
    const voucherId = res.data.id
    const voucher = res.data.lnurl
    // Register LNURL withdraw link Id in database
    res = await LNbits.api
      .request(
        'POST',
        '/monopoly/api/v1/games/invite_voucher',
        game.player.wallets[0].inkey,
        {
          game_id: game.marketData.id,
          voucher_id: voucherId
        }
      )
    if(res.data) {
      console.log("Monopoly: invite voucher created successfully")
      // Save lnurl voucher Id in local storage
      game.inviteVoucherId = voucherId;
      localStorage.setItem(
        'monopoly.game_' + game.marketData.id + '_' + game.player.id + '_' + game.player.wallet_id + '.inviteVoucherId',
        game.inviteVoucherId.toString()
      )
      // Claim LNURL voucher for game creator
      await claimInviteVoucher(voucher, game, game.player.wallets[0]);
      setTimeout(() => {
        // Refresh page to refresh game creator's player wallet balance in left panel
        window.location.reload();
      }, 250)

    } else {
      LNbits.utils.notifyApiError(res.error)
    }
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}

// Logic to delete game voucher once game starts
export async function deleteInviteVoucher(game) {
  if(game.inviteVoucherId) {
    console.log("Deleting LNURL voucher " + game.inviteVoucherId)
    // Delete LNURL withdraw link
    let res = await LNbits.api
      .request('DELETE', '/withdraw/api/v1/links/' + game.inviteVoucherId, game.marketData.wallets[0].adminkey);
    if(res.data.success) {
      game.inviteVoucherId = null
      game.inviteVoucher = null
      // Save game data to local storage
      localStorage.setItem(
        'monopoly.game_' + game.marketData.id + '_' + game.player.id + '_' + game.player.wallet_id + '.inviteVoucherId',
        game.inviteVoucherId
      )
      localStorage.setItem(
        'monopoly.game_' + game.marketData.id + '_' + game.player.id + '_' + game.player.wallet_id + '.inviteVoucher',
        game.inviteVoucher
      )
      console.log("LNURL voucher deleted successfully")
    } else {
      LNbits.utils.notifyApiError(res.error)
    }
  }
}
