import {
  fetchPaymentsToPlayer,
  fetchFundingInvoicePaid,
  fetchWalletsBalances
} from './api.js'
import {
  fetchGameStarted,
  fetchPlayers,
  fetchPlayerTurn,
  fetchPlayersBalances,
  fetchProperties
} from './database.js'

const PERIOD = 2000;

// Logic to check periodically for payments to player wallet
export async function checkPaymentsToPlayer(game) {
  clearInterval(game.playerPaymentChecker)
  await fetchPaymentsToPlayer(game)
  game.playerPaymentChecker = setInterval(async () => {
    await fetchPaymentsToPlayer(game)
  }, PERIOD)
}

// Logic to check periodically if game funding invoice has been paid
export async function checkFundingInvoicePaid(game, invoiceReason = null) {
  clearInterval(game.fundingInvoice.paymentChecker)
  await fetchFundingInvoicePaid(game, invoiceReason)
  game.fundingInvoice.paymentChecker = setInterval(async () => {
    await fetchFundingInvoicePaid(game, invoiceReason)
  }, PERIOD)
}

// Logic to check wallets balance periodically
export async function checkWalletsBalances(game, wallets) {
  clearInterval(game.walletsBalancesChecker)
  await fetchWalletsBalances(game, wallets)
  game.walletsBalancesChecker = setInterval(async () => {
    await fetchWalletsBalances(game, wallets)
  }, PERIOD)
}

// Logic to check periodically if game has been started by creator
export async function checkGameStarted(game) {
  clearInterval(game.gameStartedChecker)
  await fetchGameStarted(game)
  game.gameStartedChecker = setInterval(async () => {
    await fetchGameStarted(game)
  }, PERIOD)
}

// Logic to check periodically for new players joining the game
export async function checkPlayers(game) {
  clearInterval(game.playersChecker) // Interval should be cleared again when game starts
  await fetchPlayers(game)
  game.playersChecker = setInterval(async () => {
    await fetchPlayers(game)
  }, PERIOD)
}

// Logic to check periodically for new current player turn
export async function checkPlayerTurn(game) {
  clearInterval(game.playerTurnChecker)
  await fetchPlayerTurn(game)
  game.playerTurnChecker = setInterval(async () => {
    await fetchPlayerTurn(game)
  }, PERIOD)
}

// Logic to check other players balances periodically
export async function checkPlayersBalances(game) {
  clearInterval(game.playersBalancesChecker)
  await fetchPlayersBalances(game)
  game.playersBalancesChecker = setInterval(async () => {
    await fetchPlayersBalances(game)
  }, PERIOD)
}

// Logic to check properties ownership periodically
export async function checkProperties(game) {
  clearInterval(game.propertiesChecker)
  await fetchProperties(game)
  game.propertiesChecker = setInterval(async () => {
    await fetchProperties(game)
  }, PERIOD)
}
