import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, BackHandler, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';

export type DialogButtonStyle = 'default' | 'destructive' | 'cancel';

export type DialogButton = {
  text: string;
  style?: DialogButtonStyle;
  value?: string;
};

export type DialogConfig = {
  title: string;
  message?: string;
  buttons?: DialogButton[];
  dismissable?: boolean;
};

type DialogContextValue = {
  show: (config: DialogConfig) => Promise<string | null>;
  confirm: (config: {
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
  }) => Promise<boolean>;
  alert: (config: { title: string; message?: string; buttonText?: string }) => Promise<void>;
};

const DialogContext = createContext<DialogContextValue | undefined>(undefined);

const CONFIRM_VALUE = '__confirm__';
const CANCEL_VALUE = '__cancel__';

type ActiveDialog = {
  config: DialogConfig;
  resolve: (value: string | null) => void;
};

export function DialogProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveDialog | null>(null);
  const progress = useRef(new Animated.Value(0)).current;

  const settle = useCallback(
    (value: string | null) => {
      setActive((current) => {
        current?.resolve(value);
        return null;
      });
    },
    [],
  );

  const show = useCallback((config: DialogConfig) => {
    return new Promise<string | null>((resolve) => {
      setActive({ config, resolve });
    });
  }, []);

  const confirm = useCallback<DialogContextValue['confirm']>(
    async ({ title, message, confirmText, cancelText, destructive }) => {
      const result = await show({
        title,
        message,
        buttons: [
          { text: cancelText ?? 'Cancel', style: 'cancel', value: CANCEL_VALUE },
          {
            text: confirmText ?? 'Confirm',
            style: destructive ? 'destructive' : 'default',
            value: CONFIRM_VALUE,
          },
        ],
      });
      return result === CONFIRM_VALUE;
    },
    [show],
  );

  const alert = useCallback<DialogContextValue['alert']>(
    async ({ title, message, buttonText }) => {
      await show({
        title,
        message,
        buttons: [{ text: buttonText ?? 'OK', style: 'default', value: CONFIRM_VALUE }],
      });
    },
    [show],
  );

  useEffect(() => {
    Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [active, progress]);

  useEffect(() => {
    if (!active) {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (active.config.dismissable !== false) {
        settle(null);
      }
      return true;
    });

    return () => subscription.remove();
  }, [active, settle]);

  const value = useMemo<DialogContextValue>(() => ({ show, confirm, alert }), [show, confirm, alert]);

  const buttons = active?.config.buttons ?? [{ text: 'OK', style: 'default' as const, value: CONFIRM_VALUE }];
  const stacked = buttons.length > 2;

  return (
    <DialogContext.Provider value={value}>
      <View style={styles.root}>
        {children}

        {active ? (
          <Animated.View style={[styles.overlay, { opacity: progress }]} pointerEvents="auto">
            <Pressable
              style={styles.backdrop}
              onPress={() => {
                if (active.config.dismissable !== false) {
                  settle(null);
                }
              }}
            />

            <Animated.View
              style={[
                styles.card,
                {
                  transform: [
                    {
                      scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.title}>{active.config.title}</Text>
              {active.config.message ? (
                <Text style={styles.message}>{active.config.message}</Text>
              ) : null}

              <View style={[styles.buttonRow, stacked && styles.buttonColumn]}>
                {buttons.map((button, index) => {
                  const isCancel = button.style === 'cancel';
                  const isDestructive = button.style === 'destructive';

                  return (
                    <Pressable
                      key={button.value ?? button.text}
                      onPress={() => settle(button.value ?? button.text)}
                      style={({ pressed }) => [
                        styles.button,
                        stacked ? styles.buttonStacked : styles.buttonInline,
                        isCancel ? styles.buttonCancel : styles.buttonPrimary,
                        isDestructive && styles.buttonDestructive,
                        !stacked && index > 0 && styles.buttonGap,
                        pressed && styles.buttonPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={button.text}
                    >
                      <Text
                        style={[
                          styles.buttonText,
                          isCancel ? styles.buttonTextCancel : styles.buttonTextPrimary,
                        ]}
                      >
                        {button.text}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          </Animated.View>
        ) : null}
      </View>
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogContextValue {
  const context = useContext(DialogContext);

  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }

  return context;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    zIndex: 1000,
    elevation: 1000,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(20, 10, 26, 0.45)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.white,
    borderRadius: 22,
    paddingTop: 24,
    paddingHorizontal: 22,
    paddingBottom: 18,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  buttonColumn: {
    flexDirection: 'column',
    gap: 10,
  },
  button: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonInline: {
    flex: 1,
  },
  buttonStacked: {
    width: '100%',
  },
  buttonGap: {
    marginLeft: 10,
  },
  buttonPrimary: {
    backgroundColor: colors.brand,
  },
  buttonDestructive: {
    backgroundColor: '#DC2626',
  },
  buttonCancel: {
    backgroundColor: colors.inputGray,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '800',
  },
  buttonTextPrimary: {
    color: colors.white,
  },
  buttonTextCancel: {
    color: colors.text,
  },
});
