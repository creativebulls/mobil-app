import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Tracks keyboard visibility and Android IME height.
 * On iOS, `bottomInset` is always 0 — use KeyboardAvoidingView instead.
 */
export function useKeyboardInset(): { bottomInset: number; isOpen: boolean } {
  const [bottomInset, setBottomInset] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      if (Platform.OS === 'android') {
        setBottomInset(event.endCoordinates.height);
        setIsOpen(true);
        return;
      }
      setIsOpen(true);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      if (Platform.OS === 'android') {
        setBottomInset(0);
      }
      setIsOpen(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return { bottomInset, isOpen };
}
