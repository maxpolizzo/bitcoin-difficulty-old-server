/* globals decode*/

export async function checkMaxNumberOfPlayersReached(game_id) {
  // Check current number of players vs max number of players
  let res = await LNbits.api
    .request(
      'GET',
      '/monopoly/api/v1/players_count?game_id=' + game_id,
      window.user.wallets[0].inkey
    )
  if(res.data) {
    let current_players_count = res.data['COUNT(*)']
    res = await LNbits.api
      .request(
        'GET',
        '/monopoly/api/v1/max_players_count?game_id=' + game_id,
        window.user.wallets[0].inkey
      )
    if(res.data) {
      let max_players_count = res.data['max_players_count']
      if(current_players_count < max_players_count) {
        return false
      } else {
        return true
      }
    } else {
      LNbits.utils.notifyApiError(res.error)
    }
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}

export async function claimInviteVoucher (lnurl, game, wallet) {
  const lnurlData = await decodeLNURL(lnurl, wallet);
  const amount = lnurlData.maxWithdrawable / 1000; // mSats to sats conversion
  let result = await withdrawFromLNURL(lnurlData, game, wallet, amount, 'invite');
  if(result) {
    console.log(game.player.name +  " successfully claimed invite voucher")
  }
}

export async function createPlayerPayLNURL(game) {
  const payLNURLData = {
    description: game.player.name + " pay link",
    min: 1,
    max: 1000000,
    comment_chars: 100,
    success_text: "Payment to " + game.player.name + " confirmed"
  }
  // Create LNURL pay link
  let res = await LNbits.api
    .request('POST', '/lnurlp/api/v1/links', game.player.wallets[0].adminkey, payLNURLData);
  if(res.data) {
    const payLinkId = res.data.id
    const payLink = res.data.lnurl
    // Register LNURL pay link in database
    res = await LNbits.api
      .request(
        'PUT',
        '/monopoly/api/v1/players/pay_link',
        game.player.wallets[0].inkey,
        {
          player_wallet_id: game.player.wallet_id,
          player_pay_link_id: payLinkId,
          player_pay_link: payLink
        }
      )
    if(res.data) {
      console.log(game.player.name +  " LNURL pay link created successfully " + payLink)
      const playerPayLinkCreated = true
      // Saving game.playerPayLinkCreated in local storage
      localStorage.setItem(
        'monopoly.game_' + game.marketData.id + '_' + game.player.id + '_' + game.player.wallet_id + '.playerPayLinkCreated',
        playerPayLinkCreated.toString()
      )
      return playerPayLinkCreated;
      // No need to save payLinkId and payLink in local storage (will be fetched from database by other players)
    } else {
      LNbits.utils.notifyApiError(res.error)
    }
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}

export async function decodeLNURL(lnurl, wallet) {
  // Format LNURL request
  let request = lnurl.toLowerCase();
  if (
    request.toLowerCase().startsWith('lnurl1') ||
    request.match(/[\w.+-~_]+@[\w.+-~_]/)
  ) {
    let res = await LNbits.api
      .request(
        'GET',
        '/api/v1/lnurlscan/' + request,
        wallet.adminkey
      )
    if(res.data) {
      if (res.data.status === 'ERROR') {
        LNbits.utils.notifyApiError(`${res.data.domain} lnurl call failed. Reason: ${res.data.reason}`)
      }
      return res.data;
    } else {
      LNbits.utils.notifyApiError(res.error)
    }
  }
}

export async function withdrawFromLNURL(lnurlData, game, wallet, amount, type) {
  console.log("Claiming " + amount + " sats...")
  let res = await LNbits.api
    .createInvoice(
      wallet, // wallet
      amount, // amount
      lnurlData.defaultDescription, // memo
      'sat', // unit
      lnurlData.callback // Create invoice from LNURL
    )
  if(res.data) {
    if (res.data.lnurl_response !== null) {
      if (res.data.lnurl_response === false) {
        res.data.lnurl_response = `Unable to connect`
      }
      if (typeof res.data.lnurl_response === 'string') {
        // failure
        console.log(`${lnurlData.domain} lnurl-withdraw call failed: ${res.data.lnurl_response}`)
      } else if (res.data.lnurl_response === true) {
        console.log(`Invoice sent to ${lnurlData.domain}!`)
        // Store payment hash in local storage
        localStorage.setItem(
          'monopoly.game_' + game.marketData.id + '_' + game.player.id + '_' + game.player.wallet_id + '.' + type + 'VoucherPaymentHash',
          // 'monopoly.game.' + type + 'VoucherPaymentHash',
          JSON.stringify(res.data.payment_hash)
        )
        // Check for invoice payment
        return await checkForPayment(res.data.payment_hash, game, wallet)
      }
    }
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}

export async function checkForPayment(paymentHash, game, wallet) {
  let paymentChecker = setInterval(async () => {
    console.log("Checking for payment...")
    let res = await LNbits.api.getPayment(wallet, paymentHash)
    if(res.data) {
      if (res.data.paid) {
        onPaymentReceived(paymentChecker, game)
      }
    } else {
      LNbits.utils.notifyApiError(res.error)
    }
  }, 5000)
  return true
}

export function onPaymentReceived(paymentChecker, game) {
  clearInterval(paymentChecker)
  localStorage.setItem(
    'monopoly.game_' + game.marketData.id + '_' + game.player.id + '_' + game.player.wallet_id + '.paidVoucher',
    // 'monopoly.game.paidVoucher',
    JSON.stringify(true)
  )
  console.log("Successfully claimed LNURL voucher")
}

export function decodeInvoice(invoiceData) {
  let invoice
  try {
    invoice = decode(invoiceData)
  } catch (error) {
    console.log(error)
    // LNbits.utils.notifyApiError(error)
    return
  }

  let cleanInvoice = {
    msat: invoice.human_readable_part.amount,
    sat: invoice.human_readable_part.amount / 1000,
    fsat: LNbits.utils.formatSat(invoice.human_readable_part.amount / 1000)
  }

  _.each(invoice.data.tags, tag => {
    if (_.isObject(tag) && _.has(tag, 'description')) {
      if (tag.description === 'payment_hash') {
        cleanInvoice.hash = tag.value
      } else if (tag.description === 'description') {
        cleanInvoice.description = tag.value
      } else if (tag.description === 'expiry') {
        var expireDate = new Date(
          (invoice.data.time_stamp + tag.value) * 1000
        )
        cleanInvoice.expireDate = Quasar.utils.date.formatDate(
          expireDate,
          'YYYY-MM-DDTHH:mm:ss.SSSZ'
        )
        cleanInvoice.expired = false // TODO
      }
    }
  })

  return(cleanInvoice);
}

