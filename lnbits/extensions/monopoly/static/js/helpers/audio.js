import {
  dragAndDropCardSoundURI,
  cashRegisterSoundURI,
  bellSoundURI
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
