import { newGame } from '../data/data.js'
import { claimInviteVoucher } from '../helpers/utils.js'
import { storeGameData } from '../helpers/storage.js'
import { freeMarketWallet, playerWallet, inkey } from '../helpers/helpers.js'
import {
  playPlayerPaymentReceivedSound,
  playMarketPaymentReceivedSound
} from '../helpers/audio.js'

export async function createWebsocketAuthorizationToken(game) {
  let playerIndex = game.created ? '0' : game.player.index
  let res = await LNbits.api
    .request(
      'POST',
      '/play/api/v1/ws-auth-token',
      inkey(game),
      {
        game_id: game.id,
        player_index: playerIndex
      }
    );
  if(res.data) {
    return res.data
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}

export async function fetchPaymentsToPlayer(game, reloadFromDatabase = false) {
  const res = await LNbits.api.getPayments(game.player.wallet);
  if(res.data) {
    const payments = res.data
      .map(obj => {
        return LNbits.map.payment(obj)
      })
      .sort((a, b) => {
        return b.time - a.time
      })
    for (let index in payments) {
      const payment = payments[index]
      if(game.playerWallet.payments[payment.payment_hash]) {
        if(game.playerWallet.payments[payment.payment_hash].pending && !payment.pending) {
          game.playerWallet.payments[payment.payment_hash].pending = false
          if(payment.isIn) {
            console.log("Player wallet received a payment")
            if(!reloadFromDatabase) {
              // Play sound
              playPlayerPaymentReceivedSound()
            }
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
            if(!reloadFromDatabase) {
              // Play sound
              playPlayerPaymentReceivedSound()
            }
          } else  {
            console.log("Player wallet sent a payment")
          }
        }
      }
    }
    // Save payments to player in local storage
    storeGameData(game, 'playerWallet', game.playerWallet)
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}

export async function fetchFundingInvoicePaid(game, invoiceReason = null) {
  const res = await LNbits.api.getPayment(freeMarketWallet(game), game.fundingInvoice.paymentHash);
  if(res.data) {
    if (res.data.paid) {
      console.log("Funding invoice paid!")
      playMarketPaymentReceivedSound()
      // Clear payment checker interval
      clearInterval(game.fundingInvoice.paymentChecker)
      // Erase previous funding invoice
      game.fundingInvoiceAmount = 0
      game.fundingInvoice.paymentReq = null
      game.fundingInvoice = newGame.fundingInvoice
      // Save funding invoice template in local storage
      storeGameData(game, 'fundingInvoiceAmount', game.fundingInvoiceAmount)
      storeGameData(game, 'fundingInvoice', game.fundingInvoice)
    }
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}

export async function fetchWalletsBalances(game) {
  // Fetch player balance
  if(game.player.wallet && playerWallet(game).id) {
    let res = await LNbits.api.getWallet({
      inkey: inkey(game)
    })
    if(res.data) {
      const balanceBefore = game.playerBalance
      const playerBalance = Math.round(res.data.balance / 1000).toString()
      if(playerBalance !== balanceBefore) {
        game.playerBalance = playerBalance
        // Update user balance in local storage
        storeGameData(game, 'playerBalance', game.playerBalance)
        // Update user balance in database
        res = await LNbits.api
          .request(
            'PUT',
            '/play/api/v1/wallet/balance',
            inkey(game),
            {
              game_id: game.id,
              player_index: game.player.index,
              balance: game.playerBalance
            }
          );
        if(res.error) {
          LNbits.utils.notifyApiError(res.error)
        }
        // Refresh wallet balance in LNBits left panel
        /*
        EventHub.$emit('update-wallet-balance', [
          playerWallet(game).id,
          game.playerBalance
        ])
        */
        // Implemented the following  hack because using 'update-wallet-balance' event would reset other wallets
        // live_fsat to their fsat value which is not updated for some reason
        wallets.forEach((wallet) => {
          if(wallet.id === playerWallet(game).id) {
            wallet.fsat = game.playerBalance
            wallet.live_fsat = game.playerBalance
          }
        })
      }
    } else {
      LNbits.utils.notifyApiError(res.error)
    }
  }
  // Fetch free market wallet balance
  const freeMarketLiquidityBefore = game.freeMarketLiquidity
  if(game.freeMarketWallet && game.freeMarketWallet.index) {
    // Game creator fetches free market balance from LNBits API and registers it in database
    let res = await LNbits.api.getWallet({
      inkey: inkey(game)
    })
    if(res.data) {
      const freeMarketLiquidity = Math.round(res.data.balance / 1000).toString()
      if(freeMarketLiquidity !== freeMarketLiquidityBefore) {
        game.freeMarketLiquidity = freeMarketLiquidity
        // Update free market liquidity in local storage
        storeGameData(game, 'freeMarketLiquidity', game.freeMarketLiquidity)
        // Update free market liquidity in database
        res = await LNbits.api
          .request(
            'PUT',
            '/play/api/v1/game/free-market-liquidity',
            freeMarketWallet(game).adminkey,
            {
              game_id: game.id,
              free_market_liquidity: game.freeMarketLiquidity
            }
          );
        if(res.error) {
          LNbits.utils.notifyApiError(res.error)
        }
        // Refresh wallet balance in LNBits left panel
        // Implemented the following hack because using 'update-wallet-balance' event would reset other wallets
        // live_fsat to their fsat value which is not updated for some reason
        wallets.forEach((wallet) => {
          if(wallet.id === freeMarketWallet(game).id) {
            wallet.fsat = game.freeMarketLiquidity
            wallet.live_fsat = game.freeMarketLiquidity
          }
        })
      }
    } else {
      LNbits.utils.notifyApiError(res.error)
    }
  } else if(game.initialFunding) {
    // Invited players fetch free market balance from database
    let res = await LNbits.api
      .request(
        'GET',
        '/play/api/v1/free-market-liquidity?game_id=' + game.id,
        inkey(game),
      )
    if(res.data) {
      const freeMarketLiquidity = res.data.free_market_liquidity
      if(freeMarketLiquidity !== freeMarketLiquidityBefore) {
        game.freeMarketLiquidity = freeMarketLiquidity
        // Save free market liquidity in local storage
        storeGameData(game, 'freeMarketLiquidity', game.freeMarketLiquidity)
      }
    } else {
      LNbits.utils.notifyApiError(res.error)
    }
  }
}

export async function createGameVouchers(game) {
  // await createRewardVoucher(game)
  await createInviteVoucher(game)
}
/*
// Logic to create LNURl voucher from game funding wallet, to be claimed for players rewards
export async function createRewardVoucher(game) {
  // Create rewards voucher
  const voucherData = {
    custom_url: null,
    is_unique: false,
    max_withdrawable: game.initialFunding,
    min_withdrawable: 1,
    title: "Bitcoin Difficulty rewards voucher",
    use_custom: false,
    wait_time: 1,
    uses: 250 // max number of uses allowed by the withdraw extension
  }
  // Create LNURL withdraw link
  let res = await LNbits.api
    .request(
      'POST',
      '/withdraw/api/v1/links',
      freeMarketWallet(game).adminkey,
      voucherData
    );
  if(res.data) {
    const voucherId = res.data.id
    const voucher = res.data.lnurl
    // Register LNURL withdraw link Id in database
    res = await LNbits.api
      .request(
        'POST',
        '/play/api/v1/game/reward-voucher',
        freeMarketWallet(game).adminkey,
        {
          game_id: game.id,
          voucher_id: voucherId
        }
      )
    if(res.status === 201) {
      console.log("Difficulty: reward voucher created successfully")
      // Save lnurl voucher id in local storage
      game.rewardVoucherId = voucherId;
      storeGameData(game, 'rewardVoucherId', game.rewardVoucherId)
      // Save lnurl voucher in local storage
      game.rewardVoucher = voucher;
      storeGameData(game, 'rewardVoucher', game.rewardVoucher)
    } else {
      LNbits.utils.notifyApiError(res.error)
    }
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}
*/
// Logic to create LNURl voucher from game funding wallet, to be claimed by invited players
export async function createInviteVoucher(game) {
  // Creat invite voucher
  const voucherData = {
    custom_url: null,
    is_unique: false,
    max_withdrawable: game.initialPlayerBalance,
    min_withdrawable: game.initialPlayerBalance,
    title: "Bitcoin Difficulty invite voucher",
    use_custom: false,
    wait_time: 1,
    uses: game.maxPlayersCount // Maximum number of players to be invited via voucher (including game creator)
  }
  // Create LNURL withdraw link
  let res = await LNbits.api
    .request(
      'POST',
      '/withdraw/api/v1/links',
      freeMarketWallet(game).adminkey,
      voucherData
    );
  if(res.data) {
    const voucherId = res.data.id
    const voucher = res.data.lnurl
    // Register LNURL withdraw link Id in database
    res = await LNbits.api
      .request(
        'POST',
        '/play/api/v1/game/invite-voucher',
        freeMarketWallet(game).adminkey,
        {
          game_id: game.id,
          voucher_id: voucherId
        }
      )
    if(res.status === 201) {
      console.log("Bitcoin Difficulty: invite voucher created successfully")
      // Save lnurl voucher id in local storage
      game.inviteVoucherId = voucherId;
      storeGameData(game, 'inviteVoucherId', game.inviteVoucherId)
      // Show invite button
      game.showInviteButton = true
      // Claim LNURL voucher for game creator
      await claimInviteVoucher(voucher, game, game.player.wallet);
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
      .request('DELETE', '/withdraw/api/v1/links/' + game.inviteVoucherId, freeMarketWallet(game).adminkey);
    if(res.data.success) {
      game.inviteVoucherId = null
      // Save game data to local storage
      storeGameData(game, 'inviteVoucherId', game.inviteVoucherId)
      console.log("LNURL voucher deleted successfully")
    } else {
      LNbits.utils.notifyApiError(res.error)
    }
  }
}
