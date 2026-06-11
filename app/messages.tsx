import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeedHeader } from '../src/components/FeedHeader';
import { MainScreenLayout } from '../src/components/MainScreenLayout';
import { colors } from '../src/theme/colors';

export default function MessagesScreen() {
  return (
    <MainScreenLayout activeTab="messages">
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <FeedHeader title="Messages" />

        <View style={styles.content}>
          <Text style={styles.title}>No messages yet</Text>
          <Text style={styles.subtitle}>Start a conversation with friends nearby.</Text>
        </View>
      </SafeAreaView>
    </MainScreenLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
