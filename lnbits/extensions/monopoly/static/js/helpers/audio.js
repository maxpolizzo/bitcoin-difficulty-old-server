import {dragAndDropCardSoundURI} from '../data/sounds.js'

export function playCardSound() {
  // Convert mp3 or wav files into Data URI format: https://dopiaza.org/tools/datauri/index.php
  const snd = new Audio(dragAndDropCardSoundURI);
  snd.play();
}