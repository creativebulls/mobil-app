import { useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, Platform, type KeyboardEvent } from 'react-native';

/** Emoji / sticker row above Gboard and similar Android IMEs (~40dp). */
const ANDROID_IME_ACCESSORY_INSET = 44;

function readAndroidKeyboardInset(event?: KeyboardEvent): number {
  const metrics = event?.endCoordinates ?? Keyboard.metrics();
  if (!metrics) {
    return 0;
  }

  const windowHeight = Dimensions.get('window').height;
  const insetFromScreenY = Math.max(0, windowHeight - metrics.screenY);
  const reported = Math.max(metrics.height, insetFromScreenY);

  // IME height events often omit the accessory toolbar on first show.
  return reported + ANDROID_IME_ACCESSORY_INSET;
}

/**
 * Tracks keyboard visibility and Android IME height.
 * On iOS, `bottomInset` is always 0 — use KeyboardAvoidingView instead.
 */
export function useKeyboardInset(): { bottomInset: number; isOpen: boolean } {
  const [bottomInset, setBottomInset] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const pollTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    function clearPolls() {
      pollTimersRef.current.forEach(clearTimeout);
      pollTimersRef.current = [];
    }

    function applyAndroidInset(event?: KeyboardEvent) {
      const inset = readAndroidKeyboardInset(event);
      if (inset <= 0) {
        return;
      }
      setBottomInset((prev) => Math.max(prev, inset));
      setIsOpen(true);
    }

    function scheduleAndroidPolls() {
      clearPolls();
      for (const delay of [100, 250, 450]) {
        pollTimersRef.current.push(
          setTimeout(() => {
            applyAndroidInset();
          }, delay),
        );
      }
    }

    const showSub = Keyboard.addListener(showEvent, (event) => {
      if (Platform.OS === 'android') {
        applyAndroidInset(event);
        scheduleAndroidPolls();
        return;
      }
      setIsOpen(true);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      if (Platform.OS === 'android') {
        clearPolls();
        setBottomInset(0);
      }
      setIsOpen(false);
    });

    return () => {
      clearPolls();
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return { bottomInset, isOpen };
}
