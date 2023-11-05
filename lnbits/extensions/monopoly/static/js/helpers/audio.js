import {
  dragAndDropCardSoundURI,
  cashRegisterSoundURI,
  bellSoundURI,
  nextPlayerTurnSoundURI,
  newPlayerJoinedSoundURI,
  startGameSoundURI
} from '../data/sounds.js'

export function playCardSound() {
  const snd = new Audio(dragAndDropCardSoundURI);
  snd.play();
}

export function playPlayerPaymentReceivedSound() {
  const snd = new Audio(bellSoundURI);
  snd.play();
}

export function playMarketPaymentReceivedSound() {
  const snd = new Audio(cashRegisterSoundURI);
  snd.play();
}

export function playNextPlayerTurnSound() {
  const snd = new Audio(nextPlayerTurnSoundURI);
  snd.play();
}

export function playPlayerJoinedSound() {
  const snd = new Audio(newPlayerJoinedSoundURI);
  snd.play();
}

export function playStartGameSound() {
  const snd = new Audio(startGameSoundURI);
  snd.play();
}
