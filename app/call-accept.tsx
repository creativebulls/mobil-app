import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { emitCallAcceptIntent } from '../src/calls/callIntentBus';
import { colors } from '../src/theme/colors';

/**
 * Landing route opened by the native incoming-call notification (deep link).
 * It hands the call to the CallProvider — auto-accepting when the user tapped
 * "Accept" — then bounces to home so the global call overlay can take over.
 */
export default function CallAcceptScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    callId?: string;
    fromUserId?: string;
    autoAccept?: string;
  }>();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) {
      return;
    }
    handled.current = true;

    if (params.callId && params.autoAccept === '1') {
      emitCallAcceptIntent({ callId: params.callId, fromUserId: params.fromUserId ?? null });
    }

    // Replace this transient screen; the call overlay renders on top globally.
    router.replace('/home');
  }, [params.autoAccept, params.callId, params.fromUserId, router]);

  return (
    <View style={styles.root}>
      <ActivityIndicator size="large" color={colors.brand} />
      <Text style={styles.text}>Connecting call…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: colors.white,
  },
  text: {
    fontSize: 15,
    color: colors.textSecondary,
  },
});
