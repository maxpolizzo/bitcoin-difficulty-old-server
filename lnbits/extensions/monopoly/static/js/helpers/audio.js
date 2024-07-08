import {
  newPlayerJoinedURI,
  gameStartsURI,
  boughtPropertyURI,
  boughtMinerURI,
  boughtCitadelURI,
  colorCompletedURI,
  playerRektURI,
  nextPlayerTurnURI,
  developmentCardURI,
  blackSwanCardURI,
  playerPaymentReceivedURI,
  playerSentPaymentToFreeMarketURI,
  newBlockMinedURI,
  taxationIsTheftURI
} from '../data/sounds.js'

export function playCardSound() {
  const snd = new Audio(dragAndDropCardSoundURI);
  snd.play();
}

export function playPlayerPaymentReceivedSound() {
  const snd = new Audio(playerPaymentReceivedURI);
  snd.play();
}

export function playPlayerSentPaymentToFreeMarketSound() {
  const snd = new Audio(playerSentPaymentToFreeMarketURI);
  snd.play();
}

// Remove
export function playMarketPaymentReceivedSound() {
  const snd = new Audio(cashRegisterSoundURI);
  snd.play();
}


export function playNextPlayerTurnSound() {
  const snd = new Audio(nextPlayerTurnURI);
  snd.play();
}

export function playPlayerJoinedSound() {
  const snd = new Audio(newPlayerJoinedURI);
  snd.play();
}

export function playStartGameSound() {
  const snd = new Audio(gameStartsURI);
  snd.play();
}

export function playBoughtPropertySound() {
  const snd = new Audio(boughtPropertyURI);
  snd.play();
}

export function playBoughtMinerSound() {
  const snd = new Audio(boughtMinerURI);
  snd.play();
}

export function playBoughtCitadelSound() {
  const snd = new Audio(boughtCitadelURI);
  snd.play();
}

export function playColorCompletedSound() {
  const snd = new Audio(colorCompletedURI);
  snd.play();
}

export function playPlayerRektSound() {
  const snd = new Audio(playerRektURI);
  snd.play();
}

export function playDevelopmentCardSound() {
  const snd = new Audio(developmentCardURI);
  snd.play();
}

export function playBlackSwanCardSound() {
  const snd = new Audio(blackSwanCardURI);
  snd.play();
}

export function playNewBlockMinedSound() {
  const snd = new Audio(newBlockMinedURI);
  snd.play();
}

export function playTaxationIsTheftSound() {
  const snd = new Audio(taxationIsTheftURI);
  snd.play();
}