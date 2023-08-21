/* globals decode*/

export async function claimInviteVoucher (lnurl, wallet) {
  const lnurlData = await decodeLNURL(lnurl, wallet);
  const amount = lnurlData.maxWithdrawable / 1000; // mSats to sats conversion
  return await withdrawFromLNURL(lnurlData, wallet, amount, 'invite');
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

export async function withdrawFromLNURL(lnurlData, wallet, amount, type) {
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
          'monopoly.game.' + type + 'VoucherPaymentHash',
          JSON.stringify(res.data.payment_hash)
        )
        // Check for invoice payment
        await checkForPayment(res.data.payment_hash, wallet)
      }
    }
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}

export async function checkForPayment(paymentHash, wallet) {
  let paymentChecker = setInterval(async () => {
    console.log("Checking for payment...")
    let res = await LNbits.api.getPayment(wallet, paymentHash)
    if(res.data) {
      if (res.data.paid) {
        onPaymentReceived(paymentChecker)
      }
    } else {
      LNbits.utils.notifyApiError(res.error)
    }
  }, 5000)
}

export function onPaymentReceived(paymentChecker) {
  clearInterval(paymentChecker)
  localStorage.setItem(
    'monopoly.game.paidVoucher',
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
