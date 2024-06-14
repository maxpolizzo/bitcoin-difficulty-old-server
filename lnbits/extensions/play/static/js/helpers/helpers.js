export function freeMarketWallet(game) {
  return (game.freeMarketWallet && game.freeMarketWallet.index)
    ? window.user.wallets[game.freeMarketWallet.index]
    : null
}
export function playerWallet(game) {
  return (game.player.wallet && (game.player.wallet.index || game.player.wallet.index === 0))
    ? window.user.wallets[game.player.wallet.index]
    : null
}

export function inkey(game) {
  return freeMarketWallet(game)
    ? freeMarketWallet(game).inkey
    : playerWallet(game)
      ? playerWallet(game).inkey
      : null
}
