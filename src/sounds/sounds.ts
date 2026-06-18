import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

// Static requires so Metro bundles the audio assets into the app.
const ringbackSource = require('../../assets/sounds/diler-end.mp3');
const incomingRingSource = require('../../assets/sounds/reciver-end.mp3');
const messageSource = require('../../assets/sounds/msgrecived.mp3');

let ringbackPlayer: AudioPlayer | null = null;
let incomingPlayer: AudioPlayer | null = null;
let messagePlayer: AudioPlayer | null = null;
let audioModeReady = false;

async function ensureAudioMode(): Promise<void> {
  if (audioModeReady) {
    return;
  }
  audioModeReady = true;
  try {
    // Play through the speaker even if the phone's ringer switch is silent.
    await setAudioModeAsync({ playsInSilentMode: true, shouldRouteThroughEarpiece: false });
  } catch {
    // Non-fatal: audio still plays with default routing.
  }
}

/** Outgoing ring the caller (dialer) hears while the other side rings. */
export function playRingback(): void {
  void ensureAudioMode();
  try {
    if (!ringbackPlayer) {
      ringbackPlayer = createAudioPlayer(ringbackSource);
      ringbackPlayer.loop = true;
    }
    void ringbackPlayer.seekTo(0).catch(() => undefined);
    ringbackPlayer.play();
  } catch {
    // ignore playback errors
  }
}

/** Incoming ring the recipient hears when a call arrives. */
export function playIncomingRing(): void {
  void ensureAudioMode();
  try {
    if (!incomingPlayer) {
      incomingPlayer = createAudioPlayer(incomingRingSource);
      incomingPlayer.loop = true;
    }
    void incomingPlayer.seekTo(0).catch(() => undefined);
    incomingPlayer.play();
  } catch {
    // ignore playback errors
  }
}

/** Stops both ring tones. */
export function stopRings(): void {
  try {
    ringbackPlayer?.pause();
    void ringbackPlayer?.seekTo(0).catch(() => undefined);
    incomingPlayer?.pause();
    void incomingPlayer?.seekTo(0).catch(() => undefined);
  } catch {
    // ignore
  }
}

/** Plays the one-shot "message received" chime. */
export function playMessageChime(): void {
  void ensureAudioMode();
  try {
    if (!messagePlayer) {
      messagePlayer = createAudioPlayer(messageSource);
    }
    void messagePlayer.seekTo(0).catch(() => undefined);
    messagePlayer.play();
  } catch {
    // ignore
  }
}
