import {
  fetchBankBalance,
  fetchFundingInvoicePaid,
  fetchPlayerBalance,
  fetchPlayerInvoicePaid
} from './api.js'
import {
  fetchGameStarted,
  fetchPlayers,
  fetchPlayersBalances,
  fetchProperties
} from './database.js'

const PERIOD = 2000;

// Logic to check periodically if game funding invoice has been paid
export function checkFundingInvoicePaid(game, invoiceReason = null) {
  clearInterval(game.fundingInvoice.paymentChecker)
  game.fundingInvoice.paymentChecker = setInterval(async () => {
    await fetchFundingInvoicePaid(game, invoiceReason)
  }, PERIOD)
}

// Logic to check periodically if player invoice has been paid
export function checkPlayerInvoicePaid(game, invoiceReason = null) {
  clearInterval(game.playerInvoice.paymentChecker)
  game.playerInvoice.paymentChecker = setInterval(async () => {
    await fetchPlayerInvoicePaid(game, invoiceReason)
  }, PERIOD)
}

// Logic to check bank balance periodically
export async function checkBankBalance(game) {
  clearInterval(game.bankBalanceChecker)
  game.bankBalanceChecker = setInterval(async () => {
    await fetchBankBalance(game)
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
  let updated_game;
  game.propertiesChecker = setInterval(async () => {
    await fetchProperties(game)
  }, PERIOD)
}
