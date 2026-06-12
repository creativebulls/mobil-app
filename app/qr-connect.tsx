import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  fetchMyConnectCode,
  resolveConnectCode,
  sendFriendRequest,
} from '../src/api/profileApi';
import { getErrorMessage, type UserProfile } from '../src/api/types';
import { Avatar } from '../src/components/Avatar';
import { useDialog } from '../src/components/dialog/DialogProvider';
import { getStoredUser } from '../src/storage/authSession';
import { colors } from '../src/theme/colors';

type Mode = 'code' | 'scan';

function displayName(user: UserProfile | null): string {
  if (!user) {
    return 'You';
  }
  const full = [user.givenName ?? user.firstName, user.surname ?? user.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  return full || user.email;
}

export default function QrConnectScreen() {
  const router = useRouter();
  const dialog = useDialog();
  const [mode, setMode] = useState<Mode>('code');

  const [user, setUser] = useState<UserProfile | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [codeError, setCodeError] = useState('');
  const [loadingCode, setLoadingCode] = useState(true);

  const [permission, requestPermission] = useCameraPermissions();
  const [processing, setProcessing] = useState(false);
  const handlingRef = useRef(false);

  useEffect(() => {
    void getStoredUser().then(setUser);
  }, []);

  useEffect(() => {
    let active = true;
    setLoadingCode(true);
    setCodeError('');
    fetchMyConnectCode()
      .then((result) => {
        if (active) {
          setCode(result.code);
        }
      })
      .catch((error) => {
        if (active) {
          setCodeError(getErrorMessage(error, 'Could not load your code'));
        }
      })
      .finally(() => {
        if (active) {
          setLoadingCode(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const handleScanned = useCallback(
    async (raw: string) => {
      if (handlingRef.current) {
        return;
      }
      handlingRef.current = true;
      setProcessing(true);
      try {
        const { user: target, relationship } = await resolveConnectCode(raw);

        if (relationship.isFriend) {
          await dialog.alert({
            title: 'Already connected',
            message: `You and ${target.name} are already friends.`,
          });
          return;
        }
        if (relationship.friendRequestStatus === 'sent') {
          await dialog.alert({
            title: 'Request pending',
            message: `You already sent ${target.name} a friend request.`,
          });
          return;
        }
        if (relationship.friendRequestStatus === 'received') {
          await dialog.alert({
            title: 'They reached out first',
            message: `${target.name} already sent you a request. Check your notifications to accept it.`,
          });
          return;
        }

        const confirmed = await dialog.confirm({
          title: 'Connect on WhereAbout?',
          message: `Send a connection request to ${target.name}?`,
          confirmText: 'Send request',
          cancelText: 'Cancel',
        });
        if (!confirmed) {
          return;
        }

        await sendFriendRequest(target.id);
        await dialog.alert({
          title: 'Request sent',
          message: `${target.name} will get a notification to confirm the connection.`,
        });
        router.back();
      } catch (error) {
        await dialog.alert({
          title: 'Could not connect',
          message: getErrorMessage(error, 'This code is not valid.'),
        });
      } finally {
        setProcessing(false);
        handlingRef.current = false;
      }
    },
    [dialog, router],
  );

  function renderCode() {
    return (
      <View style={styles.codePane}>
        <View style={styles.qrCard}>
          {loadingCode ? (
            <ActivityIndicator color={colors.primary} />
          ) : code ? (
            <QRCode value={code} size={232} color={colors.text} backgroundColor={colors.white} />
          ) : (
            <Text style={styles.error}>{codeError || 'No code available'}</Text>
          )}
        </View>
        <Avatar uri={user?.profilePhotoUrl ?? null} name={displayName(user)} size={64} />
        <Text style={styles.myName}>{displayName(user)}</Text>
        <Text style={styles.hint}>
          Let another WhereAbout user scan this code to send you a connection request.
        </Text>
      </View>
    );
  }

  function renderScan() {
    if (!permission) {
      return (
        <View style={styles.scanCenter}>
          <ActivityIndicator color={colors.white} />
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={styles.scanCenter}>
          <Ionicons name="camera-outline" size={48} color={colors.white} />
          <Text style={styles.permissionText}>
            Camera access is needed to scan a friend&apos;s code.
          </Text>
          <Pressable
            onPress={() => void requestPermission()}
            style={({ pressed }) => [styles.permissionButton, pressed && styles.pressed]}
          >
            <Text style={styles.permissionButtonText}>Grant access</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={
            processing ? undefined : ({ data }) => void handleScanned(data)
          }
        />
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.reticle} />
          <Text style={styles.scanHint}>
            Point your camera at a WhereAbout connect code
          </Text>
        </View>
        {processing ? (
          <View style={styles.processingOverlay}>
            <ActivityIndicator color={colors.white} size="large" />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.root, mode === 'scan' && styles.rootDark]}>
      <StatusBar style={mode === 'scan' ? 'light' : 'dark'} />
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons
              name="chevron-back"
              size={26}
              color={mode === 'scan' ? colors.white : colors.text}
            />
          </Pressable>
          <Text style={[styles.headerTitle, mode === 'scan' && styles.headerTitleDark]}>
            Connect by code
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.tabs}>
          <Pressable
            onPress={() => setMode('code')}
            style={[styles.tab, mode === 'code' && styles.tabActive]}
          >
            <Text style={[styles.tabText, mode === 'code' && styles.tabTextActive]}>My code</Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('scan')}
            style={[styles.tab, mode === 'scan' && styles.tabActive]}
          >
            <Text style={[styles.tabText, mode === 'scan' && styles.tabTextActive]}>Scan</Text>
          </Pressable>
        </View>

        {mode === 'code' ? renderCode() : renderScan()}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  rootDark: {
    backgroundColor: '#000000',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  headerTitleDark: {
    color: colors.white,
  },
  headerSpacer: {
    width: 26,
  },
  tabs: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: 'rgba(127,127,127,0.18)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  tab: {
    paddingHorizontal: 28,
    paddingVertical: 8,
    borderRadius: 9,
  },
  tabActive: {
    backgroundColor: colors.white,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary,
  },
  codePane: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 16,
  },
  qrCard: {
    width: 280,
    height: 280,
    borderRadius: 24,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  myName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginTop: 12,
  },
  hint: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  error: {
    color: colors.brand,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  scanCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  permissionText: {
    color: colors.white,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: colors.brand,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 15,
  },
  cameraWrap: {
    flex: 1,
    overflow: 'hidden',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticle: {
    width: 240,
    height: 240,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: colors.white,
  },
  scanHint: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 24,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  pressed: {
    opacity: 0.7,
  },
});
