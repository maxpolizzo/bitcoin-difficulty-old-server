import { newGame } from '../data/data.js'
import { claimLNURLVoucher } from '../helpers/utils.js'

export async function fetchFundingInvoicePaid(game, invoiceReason = null) {
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

      if(invoiceReason) {
        console.log(invoiceReason)
        switch(invoiceReason.type) {
          case "property_upgrade":
          // update property's mining capacity
          default:
            console.warn("Unknown invoice reason: " + invoiceReason.type)
        }
      }
    } else
      await fetchBankBalance(game)
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}

export async function fetchPlayerInvoicePaid(game, invoiceReason = null) {
  const res = await LNbits.api.getPayment(game.player.wallets[0], game.playerInvoice.paymentHash);
  if(res.data) {
    if (res.data.paid) {
      console.log("Player invoice paid!")
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

export async function fetchBankBalance(game) {
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
export async function createGameVoucher(game) {
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

// Logic to delete game voucher once game starts
export async function deleteGameVoucher(game) {
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
