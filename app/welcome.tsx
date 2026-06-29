import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ListRenderItem,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppList, useAppText } from '../src/config/ConfigProvider';
import {
  WELCOME_SLIDE_1,
  WELCOME_SLIDE_2,
  WELCOME_SLIDE_3,
  WELCOME_SLIDE_COUNT,
} from '../src/constants/welcome';
import { isGuestMode } from '../src/storage/guest';
import { markWelcomeCompleted } from '../src/storage/welcome';
import { colors, isValidHex } from '../src/theme/colors';

const WELCOME_SLIDE_IMAGES = [
  require('../assets/welcome.jpg'),
  require('../assets/welcome-2.jpg'),
  require('../assets/welcome-3.png'),
] as const;
const HORIZONTAL_INSET = 25;
const SLIDE_INDICES = Array.from({ length: WELCOME_SLIDE_COUNT }, (_, index) => index);

type WelcomeLayout = {
  sectionGap: number;
  topGap: number;
  bottomGap: number;
  headlineSize: number;
  headlineLineHeight: number;
  bodySize: number;
  bodyLineHeight: number;
  imageWidth: number;
  imageHeight: number;
  carouselMinHeight: number;
};

function getWelcomeLayout(screenWidth: number, screenHeight: number, insetsTop: number, insetsBottom: number): WelcomeLayout {
  const isVeryCompact = screenHeight < 640;
  const isCompact = screenHeight < 740;

  const topChrome = insetsTop + 52;
  const footerChrome = insetsBottom + 132;
  const carouselMinHeight = Math.max(320, screenHeight - topChrome - footerChrome);

  const imageWidth = screenWidth - HORIZONTAL_INSET * 2;
  const imageHeightCap = isVeryCompact
    ? Math.min(150, screenHeight * 0.22)
    : isCompact
      ? Math.min(190, screenHeight * 0.26)
      : Math.min(280, screenHeight * 0.3);

  return {
    sectionGap: isVeryCompact ? 14 : isCompact ? 18 : 24,
    topGap: isVeryCompact ? 10 : isCompact ? 14 : 20,
    bottomGap: isVeryCompact ? 12 : isCompact ? 16 : 20,
    headlineSize: isVeryCompact ? 26 : isCompact ? 28 : 32,
    headlineLineHeight: isVeryCompact ? 32 : isCompact ? 36 : 40,
    bodySize: isVeryCompact ? 15 : isCompact ? 16 : 18,
    bodyLineHeight: isVeryCompact ? 22 : isCompact ? 24 : 26,
    imageWidth,
    imageHeight: Math.min(imageWidth * 0.72, imageHeightCap),
    carouselMinHeight,
  };
}

type WelcomeSlideProps = {
  headlineLines: string[];
  accentLine: string;
  accentColor: string;
  bodyText: string;
  layout: WelcomeLayout;
  imageSource: (typeof WELCOME_SLIDE_IMAGES)[number];
};

function WelcomeSlide({
  headlineLines,
  accentLine,
  accentColor,
  bodyText,
  layout,
  imageSource,
}: WelcomeSlideProps) {
  return (
    <ScrollView
      style={styles.slideScroll}
      contentContainerStyle={[
        styles.slideScrollContent,
        {
          minHeight: layout.carouselMinHeight,
          paddingTop: layout.topGap,
          paddingBottom: layout.bottomGap,
          gap: layout.sectionGap,
        },
      ]}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <View style={styles.headlines}>
        {headlineLines.map((line) => (
          <Text
            key={line}
            style={[
              styles.headline,
              {
                fontSize: layout.headlineSize,
                lineHeight: layout.headlineLineHeight,
              },
              line.trim() === accentLine.trim() && { color: accentColor },
            ]}
          >
            {line}
          </Text>
        ))}
      </View>

      <View style={styles.flexSpacer} />

      <View style={styles.imageWrap}>
        <Image
          source={imageSource}
          style={{
            width: layout.imageWidth,
            height: layout.imageHeight,
          }}
          resizeMode="contain"
          accessibilityLabel=""
        />
      </View>

      <View style={styles.flexSpacer} />

      <Text
        style={[
          styles.bodyText,
          {
            fontSize: layout.bodySize,
            lineHeight: layout.bodyLineHeight,
          },
        ]}
      >
        {bodyText}
      </Text>
    </ScrollView>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const listRef = useRef<FlatList<number>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const layout = useMemo(
    () => getWelcomeLayout(screenWidth, screenHeight, insets.top, insets.bottom),
    [insets.bottom, insets.top, screenHeight, screenWidth],
  );

  const skipLabel = useAppText('welcome.skip_link', 'Skip');
  const slide1Headlines = useAppList('welcome.headline_lines', WELCOME_SLIDE_1.headlineLines);
  const slide1Accent = useAppText('welcome.headline_accent_line', WELCOME_SLIDE_1.accentLine);
  const slide1Body = useAppText('welcome.body_text', WELCOME_SLIDE_1.bodyText);
  const slide2Headlines = useAppList('welcome.slide2.headline_lines', WELCOME_SLIDE_2.headlineLines);
  const slide2Accent = useAppText('welcome.slide2.headline_accent_line', WELCOME_SLIDE_2.accentLine);
  const slide2Body = useAppText('welcome.slide2.body_text', WELCOME_SLIDE_2.bodyText);
  const slide3Headlines = useAppList('welcome.slide3.headline_lines', WELCOME_SLIDE_3.headlineLines);
  const slide3Accent = useAppText('welcome.slide3.headline_accent_line', WELCOME_SLIDE_3.accentLine);
  const slide3Body = useAppText('welcome.slide3.body_text', WELCOME_SLIDE_3.bodyText);
  const nextLabel = useAppText('welcome.next_button', 'Next');
  const brandColorRaw = useAppText('theme.brand_color', colors.brand);
  const brandColor = isValidHex(brandColorRaw) ? brandColorRaw : colors.brand;

  const slideCopy = useMemo(
    () => [
      { headlineLines: slide1Headlines, accentLine: slide1Accent, bodyText: slide1Body },
      { headlineLines: slide2Headlines, accentLine: slide2Accent, bodyText: slide2Body },
      { headlineLines: slide3Headlines, accentLine: slide3Accent, bodyText: slide3Body },
    ],
    [
      slide1Accent,
      slide1Body,
      slide1Headlines,
      slide2Accent,
      slide2Body,
      slide2Headlines,
      slide3Accent,
      slide3Body,
      slide3Headlines,
    ],
  );

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  async function finishWelcome() {
    try {
      await markWelcomeCompleted();
    } catch {
      // Navigation should still work even if persistence fails.
    }

    if (await isGuestMode()) {
      router.replace('/home');
      return;
    }

    router.replace('/sign-in');
  }

  function handleSkip() {
    void finishWelcome();
  }

  function handleNext() {
    if (activeIndex < WELCOME_SLIDE_COUNT - 1) {
      const nextIndex = activeIndex + 1;
      listRef.current?.scrollToOffset({ offset: nextIndex * screenWidth, animated: true });
      setActiveIndex(nextIndex);
      return;
    }

    void finishWelcome();
  }

  function handleScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
    if (index >= 0 && index < WELCOME_SLIDE_COUNT) {
      setActiveIndex(index);
    }
  }

  const renderSlide: ListRenderItem<number> = ({ item }) => {
    const copy = slideCopy[item] ?? slideCopy[0];
    return (
      <View style={[styles.slidePage, { width: screenWidth }]}>
        <WelcomeSlide
          headlineLines={copy.headlineLines}
          accentLine={copy.accentLine}
          accentColor={brandColor}
          bodyText={copy.bodyText}
          layout={layout}
          imageSource={WELCOME_SLIDE_IMAGES[item] ?? WELCOME_SLIDE_IMAGES[0]}
        />
      </View>
    );
  };

  const footerBottomPadding = insets.bottom + (screenHeight < 640 ? 16 : 24);

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8, paddingBottom: layout.topGap }]}>
        <View style={styles.topBarSpacer} />
        <Pressable
          onPress={handleSkip}
          style={({ pressed }) => [styles.skipButton, pressed && styles.skipPressed]}
          accessibilityRole="link"
        >
          <Text style={styles.skipText}>{skipLabel}</Text>
        </Pressable>
      </View>

      <View style={styles.carousel}>
        <FlatList
          ref={listRef}
          style={styles.carouselList}
          data={SLIDE_INDICES}
          keyExtractor={(item) => String(item)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScrollEnd}
          getItemLayout={(_, index) => ({
            length: screenWidth,
            offset: screenWidth * index,
            index,
          })}
          renderItem={renderSlide}
        />
      </View>

      <View style={[styles.footer, { paddingBottom: footerBottomPadding, gap: layout.sectionGap }]}>
        <View style={styles.dots}>
          {SLIDE_INDICES.map((index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === activeIndex && [styles.dotActive, { backgroundColor: brandColor }],
              ]}
            />
          ))}
        </View>

        <Pressable
          onPress={handleNext}
          style={({ pressed }) => [
            styles.nextButton,
            { backgroundColor: brandColor, shadowColor: brandColor },
            screenHeight < 640 && styles.nextButtonCompact,
            pressed && styles.nextPressed,
          ]}
        >
          <Text style={styles.nextButtonText}>{nextLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: HORIZONTAL_INSET,
    zIndex: 2,
  },
  topBarSpacer: {
    flex: 1,
  },
  skipButton: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  skipPressed: {
    opacity: 0.7,
  },
  skipText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  carousel: {
    flex: 1,
    minHeight: 0,
  },
  carouselList: {
    flex: 1,
  },
  slidePage: {
    flex: 1,
  },
  slideScroll: {
    flex: 1,
  },
  slideScrollContent: {
    flexGrow: 1,
    paddingHorizontal: HORIZONTAL_INSET,
    justifyContent: 'flex-start',
  },
  flexSpacer: {
    flexGrow: 1,
    minHeight: 8,
    maxHeight: 40,
  },
  headlines: {
    gap: 2,
    alignItems: 'flex-start',
  },
  headline: {
    fontWeight: '700',
    color: colors.text,
    textAlign: 'left',
    letterSpacing: -0.3,
  },
  imageWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyText: {
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  footer: {
    paddingHorizontal: HORIZONTAL_INSET,
    backgroundColor: colors.white,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.labelGray,
  },
  dotActive: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  nextButton: {
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  nextButtonCompact: {
    paddingVertical: 14,
  },
  nextPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  nextButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
