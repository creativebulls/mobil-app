import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerChangeEvent,
} from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, gradients } from '../theme/colors';

type DatePickerModalProps = {
  visible: boolean;
  value: Date;
  title?: string;
  maximumDate?: Date;
  minimumDate?: Date;
  variant?: 'gradient' | 'light';
  onClose: () => void;
  onConfirm: (date: Date) => void;
};

export function DatePickerModal({
  visible,
  value,
  title = 'Select Date',
  maximumDate,
  minimumDate,
  variant = 'gradient',
  onClose,
  onConfirm,
}: DatePickerModalProps) {
  const insets = useSafeAreaInsets();
  const isLight = variant === 'light';
  const gradient = gradients.screen;
  const [draftDate, setDraftDate] = useState(value);
  const wasVisibleRef = useRef(false);

  useEffect(() => {
    if (visible) {
      setDraftDate(value);
    }
  }, [visible, value]);

  useEffect(() => {
    const wasVisible = wasVisibleRef.current;
    wasVisibleRef.current = visible;

    if (!visible || wasVisible || Platform.OS !== 'android' || !isLight) {
      return;
    }

    DateTimePickerAndroid.open({
      value,
      mode: 'date',
      maximumDate,
      minimumDate,
      title,
      positiveButton: { label: 'Done', textColor: colors.brand },
      negativeButton: { label: 'Cancel', textColor: colors.labelGray },
      onValueChange: (_event, selectedDate) => {
        onConfirm(selectedDate);
        onClose();
      },
      onDismiss: onClose,
    });
  }, [visible, isLight, value, maximumDate, minimumDate, title, onClose, onConfirm]);

  function handleValueChange(_event: DateTimePickerChangeEvent, selectedDate: Date) {
    setDraftDate(selectedDate);
  }

  function handleConfirm() {
    onConfirm(draftDate);
    onClose();
  }

  if (Platform.OS === 'android' && isLight) {
    return null;
  }

  if (!visible) {
    return null;
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay} pointerEvents="box-none">
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close date picker" />

        {isLight ? (
          <View
            style={[styles.sheetLight, { paddingBottom: Math.max(insets.bottom, 20) }]}
            pointerEvents="box-none"
          >
            <View style={styles.handleLight} />
            <View style={styles.headerLight}>
              <Pressable onPress={onClose} hitSlop={12}>
                <Text style={styles.cancelLight}>Cancel</Text>
              </Pressable>
              <Text style={styles.titleLight}>{title}</Text>
              <Pressable onPress={handleConfirm} hitSlop={12}>
                <Text style={styles.doneLight}>Done</Text>
              </Pressable>
            </View>

            <View style={styles.pickerSurfaceLight}>
              <DateTimePicker
                value={draftDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                maximumDate={maximumDate}
                minimumDate={minimumDate}
                onValueChange={handleValueChange}
                themeVariant="light"
                accentColor={colors.brand}
                textColor={colors.text}
                style={styles.picker}
              />
            </View>
          </View>
        ) : (
          <LinearGradient
            colors={[...gradient.colors]}
            start={gradient.start}
            end={gradient.end}
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}
            pointerEvents="box-none"
          >
            <View style={styles.handle} />
            <View style={styles.header}>
              <Pressable onPress={onClose} hitSlop={12}>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
              <Text style={styles.title}>{title}</Text>
              <Pressable onPress={handleConfirm} hitSlop={12}>
                <Text style={styles.done}>Done</Text>
              </Pressable>
            </View>
            <View style={styles.pickerSurfaceGradient}>
              <DateTimePicker
                value={draftDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                maximumDate={maximumDate}
                minimumDate={minimumDate}
                onValueChange={handleValueChange}
                themeVariant="dark"
                accentColor={colors.white}
                textColor={colors.white}
                style={styles.picker}
              />
            </View>
          </LinearGradient>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(45, 26, 53, 0.45)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    zIndex: 1,
  },
  sheetLight: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 3,
    borderTopColor: colors.brand,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 1,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    marginTop: 10,
    marginBottom: 6,
  },
  handleLight: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.inputGray,
    marginTop: 10,
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.25)',
  },
  headerLight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.inputGray,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textOnGradient,
  },
  titleLight: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  cancel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.75)',
  },
  cancelLight: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.labelGray,
  },
  done: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textOnGradient,
  },
  doneLight: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.brand,
  },
  pickerSurfaceLight: {
    backgroundColor: colors.inputGray,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    overflow: 'hidden',
  },
  pickerSurfaceGradient: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    overflow: 'hidden',
  },
  picker: {
    width: '100%',
    height: Platform.OS === 'ios' ? 220 : 320,
  },
});
