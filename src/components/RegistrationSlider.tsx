import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GenderDropdown } from './GenderDropdown';
import { ScreenBackRow } from './ScreenBackRow';
import { AnimatedFormInput } from './AnimatedFormInput';
import { BrandButton } from './BrandButton';
import { ConsentCheckbox } from './ConsentCheckbox';
import { DatePickerModal } from './DatePickerModal';
import { RegistrationSlideHeader } from './RegistrationSlideHeader';
import { REGISTRATION_SLIDES } from '../constants/registration';
import {
  getSignUpBirthdate,
  getSignUpGender,
  getSignUpGivenName,
  getSignUpParentalConsent,
  getSignUpSurname,
  setSignUpRegistrationDetails,
} from '../storage/signUpDraft';
import { useInputFocusAnimation } from '../hooks/useInputFocusAnimation';
import { authStyles } from '../theme/authStyles';
import { colors } from '../theme/colors';
import { isUnderAge, MINIMUM_ACCOUNT_AGE } from '../utils/age';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDE_COUNT = 3;

export type RegistrationFormData = {
  firstName: string;
  lastName: string;
  birthdate: Date | null;
  gender: string;
  consent: boolean;
  parentalConsent: boolean;
};

type RegistrationSliderProps = {
  onSubmit: (data: RegistrationFormData) => void | Promise<void>;
  resumeAt?: 'review';
  externalError?: string;
};

function formatDate(date: Date | null) {
  if (!date) {
    return '';
  }

  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function RegistrationSlider({ onSubmit, resumeAt, externalError }: RegistrationSliderProps) {
  const router = useRouter();
  const flatListRef = useRef<FlatList<number>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthdate, setBirthdate] = useState<Date | null>(null);
  const [gender, setGender] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const { setFocused: setDateFocused, containerStyle: dateContainerStyle } =
    useInputFocusAnimation('light');

  const defaultBirthdate = useMemo(() => new Date(2000, 0, 1), []);
  const minimumBirthdate = useMemo(() => new Date(1920, 0, 1), []);

  useEffect(() => {
    if (externalError) {
      setError(externalError);
    }
  }, [externalError]);

  useEffect(() => {
    const savedGivenName = getSignUpGivenName();
    const savedSurname = getSignUpSurname();
    const savedBirthdate = getSignUpBirthdate();
    const savedGender = getSignUpGender();

    if (savedGivenName && savedSurname) {
      setFirstName(savedGivenName);
      setLastName(savedSurname);
    }

    if (savedBirthdate) {
      setBirthdate(savedBirthdate);
    }

    if (savedGender) {
      setGender(savedGender);
    }

    if (resumeAt === 'review' && savedBirthdate && savedGender) {
      setActiveIndex(2);
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToIndex({ index: 2, animated: false });
      });
      return;
    }

    if (savedGivenName && savedSurname) {
      setActiveIndex(1);
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToIndex({ index: 1, animated: false });
      });
    }
  }, [resumeAt]);

  useEffect(() => {
    setDateFocused(showDatePicker || Boolean(birthdate));
  }, [showDatePicker, birthdate, setDateFocused]);

  const isLastSlide = activeIndex === SLIDE_COUNT - 1;
  const slides = [0, 1, 2];

  const isCurrentSlideValid = useMemo(() => {
    if (activeIndex === 0) {
      return Boolean(firstName.trim() && lastName.trim());
    }

    if (activeIndex === 1) {
      return Boolean(birthdate && gender);
    }

    return consent;
  }, [activeIndex, firstName, lastName, birthdate, gender, consent]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  function validateCurrentSlide(): boolean {
    setError('');

    if (activeIndex === 0) {
      if (!firstName.trim() || !lastName.trim()) {
        setError('Please enter your first and last name.');
        return false;
      }
    }

    if (activeIndex === 1) {
      if (!birthdate) {
        setError('Please select your birthdate.');
        return false;
      }
      if (!gender) {
        setError('Please select your gender.');
        return false;
      }
    }

    if (activeIndex === 2) {
      if (!consent) {
        setError('Please accept the terms and consent to submit.');
        return false;
      }
    }

    return true;
  }

  function handleNextPress() {
    if (!validateCurrentSlide()) {
      return;
    }

    if (isLastSlide) {
      void onSubmit({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        birthdate,
        gender,
        consent,
        parentalConsent: getSignUpParentalConsent(),
      });
      return;
    }

    if (activeIndex === 1 && birthdate && isUnderAge(birthdate, MINIMUM_ACCOUNT_AGE)) {
      setSignUpRegistrationDetails({ birthdate, gender });
      router.push('/parental-consent');
      return;
    }

    flatListRef.current?.scrollToIndex({
      index: activeIndex + 1,
      animated: true,
    });
    setActiveIndex(activeIndex + 1);
  }

  function openDatePicker() {
    setShowDatePicker(true);
  }

  function handleDateConfirm(date: Date) {
    setBirthdate(date);
    setError('');
  }

  function renderSlide({ item }: { item: number }) {
    const slideInfo = REGISTRATION_SLIDES[item];

    if (item === 0) {
      return (
        <ScrollView
          style={styles.slideScroll}
          contentContainerStyle={styles.slideScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.slide}>
            <RegistrationSlideHeader slide={slideInfo} variant="light" />
            <View style={authStyles.form}>
              <AnimatedFormInput
                variant="light"
                label="First Name"
                autoCapitalize="words"
                value={firstName}
                onChangeText={setFirstName}
              />

              <AnimatedFormInput
                variant="light"
                label="Last Name"
                autoCapitalize="words"
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
          </View>
        </ScrollView>
      );
    }

    if (item === 1) {
      return (
        <ScrollView
          style={styles.slideScroll}
          contentContainerStyle={styles.slideScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.slide}>
            <RegistrationSlideHeader slide={slideInfo} variant="light" />
            <View style={authStyles.form}>
              <View style={authStyles.field}>
                <Text style={authStyles.label}>Birthdate</Text>
                <Pressable
                  onPress={openDatePicker}
                  accessibilityRole="button"
                  accessibilityLabel="Select birthdate"
                >
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.dateTrigger, dateContainerStyle]}
                  >
                    <Ionicons name="calendar-outline" size={22} color={colors.brand} />
                    <Text style={[styles.dateText, !birthdate && styles.datePlaceholder]}>
                      {birthdate ? formatDate(birthdate) : 'Select birthdate'}
                    </Text>
                  </Animated.View>
                </Pressable>
              </View>

              <View style={authStyles.field}>
                <Text style={authStyles.label}>Gender</Text>
                <GenderDropdown value={gender} onChange={setGender} variant="light" />
              </View>
            </View>
          </View>
        </ScrollView>
      );
    }

    return (
      <ScrollView
        style={styles.slideScroll}
        contentContainerStyle={styles.slideScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.slide}>
          <RegistrationSlideHeader slide={slideInfo} variant="light" />
          <View style={authStyles.form}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>Name: </Text>
                {firstName} {lastName}
              </Text>
              <Text style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>Birthdate: </Text>
                {birthdate ? formatDate(birthdate) : '-'}
              </Text>
              <Text style={styles.summaryLine}>
                <Text style={styles.summaryLabel}>Gender: </Text>
                {gender || '-'}
              </Text>
            </View>

            <ConsentCheckbox
              checked={consent}
              onToggle={() => setConsent((prev) => !prev)}
              label="I agree to the Terms of Service and consent to data processing"
            />
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={authStyles.root}>
      <StatusBar style="dark" />
      <SafeAreaView style={authStyles.container}>
        <ScreenBackRow fallbackHref="/your-name" variant="light" />
        <FlatList
          ref={flatListRef}
          style={styles.slider}
          data={slides}
          keyExtractor={(item) => String(item)}
          renderItem={renderSlide}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
        />

        <View style={styles.footer}>
          <View style={styles.pagination}>
            {slides.map((slide, index) => (
              <View
                key={slide}
                style={[styles.dot, index === activeIndex && styles.dotActive]}
              />
            ))}
          </View>

          {error ? <Text style={authStyles.errorText}>{error}</Text> : null}

          <BrandButton
            label={isLastSlide ? 'Submit' : 'Next'}
            onPress={handleNextPress}
            disabled={!isCurrentSlideValid}
          />
        </View>

        <DatePickerModal
          visible={showDatePicker}
          value={birthdate ?? defaultBirthdate}
          title="Birthdate"
          variant="light"
          minimumDate={minimumBirthdate}
          maximumDate={new Date()}
          onClose={() => setShowDatePicker(false)}
          onConfirm={handleDateConfirm}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  slider: {
    flex: 1,
  },
  slideScroll: {
    width: SCREEN_WIDTH,
  },
  slideScrollContent: {
    flexGrow: 1,
    paddingBottom: 16,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    justifyContent: 'flex-start',
  },
  dateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    overflow: 'hidden',
  },
  dateText: {
    fontSize: 16,
    color: colors.brand,
    flex: 1,
  },
  datePlaceholder: {
    color: colors.labelGray,
  },
  summaryBox: {
    backgroundColor: colors.inputGray,
    borderRadius: 8,
    padding: 16,
    gap: 8,
  },
  summaryLine: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  summaryLabel: {
    fontWeight: '700',
    color: '#000000',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 16,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.inputGray,
  },
  dotActive: {
    width: 28,
    backgroundColor: colors.brand,
  },
});
