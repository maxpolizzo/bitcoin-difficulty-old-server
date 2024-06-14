import { storeGameData } from './storage.js'

import { playerWallet, freeMarketWallet } from './helpers.js'
import { properties } from '../data/properties.js'

export async function timeout(fn, ms) {
  return new Promise((resolve, reject) => {
    try {
      setTimeout(() => {
        fn()
        resolve()
      }, ms)
    } catch(err) {
      LNbits.utils.notifyApiError(err)
      reject()
    }
  });
}

export async function checkMaxNumberOfPlayersReached(game) {
  // Check current number of players vs max number of players
  let res = await LNbits.api
    .request(
      'GET',
      '/play/api/v1/players_count?game_id=' + game.id,
      playerWallet(game).inkey
    )
  if(res.data) {
    let current_players_count = res.data['COUNT(*)']
    if(current_players_count < game.maxPlayersCount) {
      return false
    } else {
      return true
    }
  } else {
    LNbits.utils.notifyApiError(res.error)
  }
}

export async function claimInviteVoucher (lnurl, game) {
  const lnurlData = await decodeLNURL(lnurl, playerWallet(game));
  const amount = lnurlData.maxWithdrawable / 1000; // mSats to sats conversion
  let result = await withdrawFromLNURL(lnurlData, game, playerWallet(game), amount, 'invite');
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
  let res = await LNbits.api.request(
    'POST',
    '/lnurlp/api/v1/links',
    playerWallet(game).inkey,
    payLNURLData
  );
  if(res.data) {
    const payLinkId = res.data.id
    const payLink = res.data.lnurl
    // Register LNURL pay link in database
    res = await LNbits.api
      .request(
        'PUT',
        '/play/api/v1/wallet/pay-link',
        playerWallet(game).inkey,
        {
          game_id: game.id,
          wallet_id: playerWallet(game).id,
          pay_link_id: payLinkId,
          pay_link: payLink
        }
      )
    if(res.data) {
      console.log(game.player.name +  " LNURL pay link created successfully " + payLink)
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
        storeGameData(game, type + 'VoucherPaymentHash', res.data.payment_hash)
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
  storeGameData(game, 'paidVoucher', true)
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

export function updateGameProperties(game, property) {
  if(property.player_index){
    // Check if property owner changed and remove property from previous owner properties if needed
    Object.keys(game.properties).forEach((ownerIndex) => {
      if(game.properties[ownerIndex][property.color]) {
        Object.keys(game.properties[ownerIndex][property.color]).forEach((key) => {
          if(
            game.properties[ownerIndex][property.color][key].property_id ===  property.property_id &&
            game.properties[ownerIndex][property.color][key].player_index !== property.player_index
          ) {
            delete game.properties[ownerIndex][property.color][key]
            if(!Object.keys(game.properties[ownerIndex][property.color]).length) {
              delete game.properties[ownerIndex][property.color]
              if(!Object.keys(game.properties[ownerIndex]).length) {
                delete game.properties[ownerIndex]
              }
            }
          }
        });
      }
    });

    // Create data structure for new owner if needed
    if(!game.properties[property.player_index]) {
      game.properties[property.player_index] = {}
      game.properties[property.player_index][property.color] = {}
    } else if(!game.properties[property.player_index][property.color]) {
      game.properties[property.player_index][property.color] = {}
    }

    // Format property data
    let updatedProperty = Object.assign({}, properties[property.color][property.property_id]);
    updatedProperty.player_index = property.player_index
    updatedProperty.mining_capacity = property.mining_capacity
    updatedProperty.mining_income = property.mining_income
    if(game.players && game.players[property.player_index]) {
      updatedProperty.player_name = game.players[property.player_index].name
    }

    // Keep property card position in case it is already owned by player
    let newProperty = true;
    if(game.properties[game.player.index] &&
      game.properties[game.player.index][property.color] &&
      Object.keys(game.properties[game.player.index][property.color]).length
    ) {
      Object.keys(game.properties[game.player.index][property.color]).forEach((key) => {
        let previouslyOwnedProperty = game.properties[game.player.index][property.color][key]
        if(previouslyOwnedProperty.property_id === property.property_id && property.player_index === game.player.index) {
          // Property was already owned by player
          newProperty = false;
          updatedProperty.position = previouslyOwnedProperty.position;
        }
      })
    }
    // If property was not already owned by player, assign position and update player propertiesCount in players table
    if(newProperty) {
      updatedProperty.position = Object.keys(game.properties[property.player_index][property.color]).length
    }

    // Add property to game.properties
    game.properties[property.player_index][property.color][property.property_id] = updatedProperty

    // Update game.propertiesCount and players propertiesCount in players table
    Object.keys(game.properties).forEach((playerIndex) => {
      game.propertiesCount[playerIndex] = 0
      Object.keys(game.properties[playerIndex]).forEach((color) => {
        game.propertiesCount[playerIndex] += Object.keys(game.properties[playerIndex][color]).length
      })
    })
    Object.keys(game.propertiesCount).forEach((playerIndex) => {
      if(!game.properties[playerIndex] || !Object.keys(game.properties[playerIndex]).length) {
        game.propertiesCount[playerIndex] = 0
      }
      game.playersData.rows.forEach((row) => {
        if(row.index === playerIndex) {
          row.propertiesCount = game.propertiesCount[playerIndex]
        }
      })
    })

    console.log(game.propertiesCount)
    console.log(game.properties)

    // If property was just sold, close property invoice dialog
    if(game.properties[game.player.index] &&
      game.properties[game.player.index][property.color] &&
      Object.keys(game.properties[game.player.index][property.color]).length
    ) {
      Object.keys(game.properties[game.player.index][property.color]).forEach((key) => {
        let previouslyOwnedProperty = game.properties[game.player.index][property.color][key]
        if(previouslyOwnedProperty.property_id === property.property_id && property.player_index !== game.player.index) {
          game.playerInvoiceAmount = null;
          game.propertySaleData = null;
          game.saleInvoiceCreated = false;
          game.showSaleInvoiceDialog = false;
          game.showPropertyInvoiceDialog = false
        }
      })
    }
  }

  return game
}

export function repositionProperties(game) {
  // Re-position player's properties in case a property was sold and a position is now empty
  if(game.properties[game.player.index] && Object.keys(game.properties[game.player.index]).length) {
    Object.keys(game.properties[game.player.index]).forEach((propertyColor) => {
      for(let pos = 0; pos < Object.keys(game.properties[game.player.index][propertyColor]).length; pos++) {
        let foundPosition = false;
        Object.keys(game.properties[game.player.index][propertyColor]).forEach((key) => {
          let property = game.properties[game.player.index][propertyColor][key]
          if(property.position === pos) {
            foundPosition = true;
          }
        });
        if(!foundPosition)  {
          // for(let i = 0; i <  Object.keys(game.properties[game.player.index][propertyColor]).length; i++) {
          Object.keys(game.properties[game.player.index][propertyColor]).forEach((key) => {
            let property = game.properties[game.player.index][propertyColor][key]
            if(property.position > pos) {
              game.properties[game.player.index][propertyColor][key].position--
            }
          })
        }
      }
    })
  }

  return game
}

export function updatePropertiesCarouselSlide(game) {
  // Update game.propertiesCarouselSlide in case property was sold and seller doesn't own any property of the same
  // color anymore
  if(game.properties[game.player.index] &&
    Object.keys(game.properties[game.player.index]) &&
    Object.keys(game.properties[game.player.index]).length
  ) {
    // If a property was just sold and player doesn't own any property of that property's color, slide properties
    // carousel to first property color owned by player
    if(!game.properties[game.player.index][game.propertiesCarouselSlide] ||
      !game.properties[game.player.index][game.propertiesCarouselSlide].length
    ) {
      game.propertiesCarouselSlide = Object.keys(game.properties[game.player.index])[0];
    }
  } else {
    game.propertiesCarouselSlide = '';
  }

  return game
}
/*
export function balanceChecker(game){
  // Loop to check user wallets balances in case player sent funds to a wallet which is not part of the game
  // Did not find another way to catch when player pays external invoices
  setInterval(async () => {
    for (let index in window.user.wallets) {
      let wallet = window.user.wallets[index]
      if(playerWallet(game) && wallet.id === playerWallet(game).id) {
        let balance = wallet.balance_msat / 1000
        if(balance !== game.playerBalance) {
          game.playerBalance = balance
          game.players[game.player.index].player_balance = balance
          for(let i = 0; i < game.playersData.rows.length; i++) {
            if(
              game.playersData.rows[i].index === game.player.index
            ) {
              game.playersData.rows[i].balance = balance
            }
          }
          await updateWalletBalance(game, game.player.index, balance, playerWallet(game).inkey)
        }
      }
      if(freeMarketWallet(game) && wallet.id === freeMarketWallet(game).id) {
        let balance = wallet.balance_msat / 1000
        if(balance !== game.freeMarketLiquidity) {
          game.freeMarketLiquidity = balance
          await updateWalletBalance(game, 0, balance, freeMarketWallet(game).inkey)
        }
      }
    }
  }, 2500)
}
*/
