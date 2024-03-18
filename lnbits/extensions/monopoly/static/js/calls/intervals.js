import {
  fetchPaymentsToPlayer,
  fetchMarketLiquidity,
  fetchFundingInvoicePaid,
  fetchPlayerBalance,
  fetchFreeMarketInvoicePaid
} from './api.js'
import {
  fetchGameStarted,
  fetchPlayers,
  fetchPlayerTurn,
  fetchPlayersBalances,
  fetchProperties
} from './database.js'

const PERIOD = 2000;

/*
// Logic to check periodically for payments to free market wallet
export async function checkPaymentsToFreeMarket(game) {
  clearInterval(game.freeMarketPaymentChecker)
  game.freeMarketPaymentChecker = setInterval(async () => {
    await fetchPaymentsToFreeMarket(game)
  }, PERIOD)
}
*/
// Logic to check periodically for payments to player wallet
export async function checkPaymentsToPlayer(game) {
  clearInterval(game.playerPaymentChecker)
  game.playerPaymentChecker = setInterval(async () => {
    await fetchPaymentsToPlayer(game)
  }, PERIOD)
}

// Logic to check periodically if game funding invoice has been paid
export function checkFundingInvoicePaid(game, invoiceReason = null) {
  clearInterval(game.fundingInvoice.paymentChecker)
  game.fundingInvoice.paymentChecker = setInterval(async () => {
    await fetchFundingInvoicePaid(game, invoiceReason)
  }, PERIOD)
}

// Is this useful?
/*
// Logic to check periodically if player invoice has been paid
export function checkPlayerInvoicePaid(game, invoiceReason = null) {
  clearInterval(game.playerInvoice.paymentChecker)
  game.playerInvoice.paymentChecker = setInterval(async () => {
    await fetchPlayerInvoicePaid(game, invoiceReason)
  }, PERIOD)
}
*/
// Logic to check periodically if free market invoice has been paid
export function checkFreeMarketInvoicePaid(game, invoiceReason = null) {
  clearInterval(game.freeMarketInvoice.paymentChecker)
  game.freeMarketInvoice.paymentChecker = setInterval(async () => {
    await fetchFreeMarketInvoicePaid(game, invoiceReason)
  }, PERIOD)
}

// Logic to check market liquidity periodically (game funding balance)
export async function checkMarketLiquidity(game) {
  clearInterval(game.marketLiquidityChecker)
  game.marketLiquidityChecker = setInterval(async () => {
    await fetchMarketLiquidity(game)
  }, PERIOD)
}

// Logic to check periodically if game has been started by creator
export async function checkGameStarted(game) {
  clearInterval(game.gameStartedChecker)
  game.gameStartedChecker = setInterval(async () => {
    await fetchGameStarted(game)
  }, PERIOD)
}

// Logic to check periodically for new players joining the game
export async function checkPlayers(game) {
  clearInterval(game.playersChecker) // Interval should be cleared again when game starts
  game.playersChecker = setInterval(async () => {
    await fetchPlayers(game)
  }, PERIOD)
}

// Logic to check periodically for new current player turn
export async function checkPlayerTurn(game) {
  clearInterval(game.playerTurnChecker) // Interval should be cleared again when game starts
  game.playerTurnChecker = setInterval(async () => {
    await fetchPlayerTurn(game)
  }, PERIOD)
}

// Logic to check player balance periodically
export async function checkPlayerBalance(game) {
  clearInterval(game.userBalanceChecker)
  game.userBalanceChecker = setInterval(async () => {
    await fetchPlayerBalance(game)
  }, PERIOD)
}

// Logic to check other players balances periodically
export async function checkPlayersBalances(game) {
  clearInterval(game.playersBalancesChecker)
  game.playersBalancesChecker = setInterval(async () => {
    await fetchPlayersBalances(game)
  }, PERIOD)
}

// Logic to check properties ownership periodically
export async function checkProperties(game) {
  clearInterval(game.propertiesChecker)
  game.propertiesChecker = setInterval(async () => {
    await fetchProperties(game)
  }, PERIOD)
}
