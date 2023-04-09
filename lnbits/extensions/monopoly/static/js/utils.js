export async function claimLNURLVoucher (lnurl, wallet) {
  const lnurlData = await decodeLNURL(lnurl, wallet);
  return await createInvoiceFromLNURL(lnurlData, wallet);
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

export async function createInvoiceFromLNURL(lnurlData, wallet) {
  const amount = lnurlData.maxWithdrawable/1000;
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
          'monopoly.game.voucherPaymentHash',
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
