import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

// Static requires so Metro bundles the audio assets into the app.
const ringtoneSource = require('../../assets/sounds/callingring.mp3');
const messageSource = require('../../assets/sounds/msgrecived.mp3');

let ringtonePlayer: AudioPlayer | null = null;
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

/** Starts the looping call ring (used for both outgoing ringback and incoming ring). */
export function playRingtone(): void {
  void ensureAudioMode();
  try {
    if (!ringtonePlayer) {
      ringtonePlayer = createAudioPlayer(ringtoneSource);
      ringtonePlayer.loop = true;
    }
    void ringtonePlayer.seekTo(0).catch(() => undefined);
    ringtonePlayer.play();
  } catch {
    // ignore playback errors
  }
}

export function stopRingtone(): void {
  try {
    ringtonePlayer?.pause();
    void ringtonePlayer?.seekTo(0).catch(() => undefined);
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
