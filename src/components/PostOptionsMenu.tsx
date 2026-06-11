import { Ionicons } from '@expo/vector-icons';
import { Fragment } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

export type PostMenuOption = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
};

type PostOptionsMenuProps = {
  visible: boolean;
  anchor: { top: number; right: number } | null;
  options: PostMenuOption[];
  onClose: () => void;
};

export function PostOptionsMenu({ visible, anchor, options, onClose }: PostOptionsMenuProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View
          style={[
            styles.menu,
            anchor ? { top: anchor.top, right: anchor.right } : styles.fallbackPosition,
          ]}
        >
          {options.map((option, index) => (
            <Fragment key={option.key}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <Pressable
                onPress={() => {
                  onClose();
                  option.onPress();
                }}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                accessibilityRole="button"
                accessibilityLabel={option.label}
              >
                <Ionicons
                  name={option.icon}
                  size={19}
                  color={option.destructive ? colors.brand : colors.text}
                />
                <Text style={[styles.label, option.destructive && styles.labelDestructive]}>
                  {option.label}
                </Text>
              </Pressable>
            </Fragment>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  menu: {
    position: 'absolute',
    minWidth: 220,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 10,
  },
  fallbackPosition: {
    top: 80,
    right: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  rowPressed: {
    backgroundColor: colors.inputGray,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: 12,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  labelDestructive: {
    color: colors.brand,
  },
});
