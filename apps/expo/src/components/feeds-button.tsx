import { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, Text, TouchableHighlight } from "react-native";
import Animated, { FadeInDown, Layout } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname } from "expo-router";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetSectionList,
} from "@gorhom/bottom-sheet";
import { useTheme } from "@react-navigation/native";
import { CircleDotIcon, CloudIcon, CloudyIcon } from "lucide-react-native";

import {
  LargeRow,
  NoFeeds,
  SectionHeader,
} from "~/app/(tabs)/(feeds,search,notifications,self)/feeds";
import { useBottomSheetStyles } from "~/lib/bottom-sheet";
import { useReorderFeeds, useSavedFeeds } from "~/lib/hooks/feeds";
import { useAppPreferences } from "~/lib/hooks/preferences";
import { BackButtonOverride } from "./back-button-override";
import { FeedRow } from "./feed-row";
import { ItemSeparator } from "./item-separator";
import { QueryWithoutData } from "./query-without-data";

export const FeedsButton = () => {
  const theme = useTheme();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const { top } = useSafeAreaInsets();
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setShow(false), 2000);
    return () => clearTimeout(timeout);
  }, []);

  const dismiss = useCallback(() => bottomSheetRef.current?.dismiss(), []);

  const {
    backgroundStyle,
    handleStyle,
    handleIndicatorStyle,
    // contentContainerStyle,
  } = useBottomSheetStyles();

  return (
    <>
      <TouchableHighlight onPress={() => bottomSheetRef.current?.present()}>
        <Animated.View
          className="absolute bottom-6 right-4 w-max max-w-max flex-1 flex-row items-center rounded-full p-4"
          style={{ backgroundColor: theme.colors.primary }}
          entering={FadeInDown}
          layout={Layout}
        >
          <Animated.View layout={Layout.springify()}>
            <CloudyIcon size={24} color="white" />
          </Animated.View>
          {show && (
            <Text className="ml-4 text-lg font-medium text-white">
              My Feeds
            </Text>
          )}
        </Animated.View>
      </TouchableHighlight>
      <BottomSheetModal
        ref={bottomSheetRef}
        enablePanDownToClose
        snapPoints={["60%", Dimensions.get("window").height - top - 10]}
        backdropComponent={(props) => (
          <BottomSheetBackdrop
            {...props}
            appearsOnIndex={0}
            disappearsOnIndex={-1}
          />
        )}
        handleIndicatorStyle={handleIndicatorStyle}
        handleStyle={handleStyle}
        backgroundStyle={backgroundStyle}
        enableDismissOnClose
      >
        <BackButtonOverride dismiss={dismiss} />
        <SheetContent dismiss={dismiss} />
      </BottomSheetModal>
    </>
  );
};

const SheetContent = ({ dismiss }: { dismiss: () => void }) => {
  const theme = useTheme();
  const savedFeeds = useSavedFeeds();
  const [{ sortableFeeds }] = useAppPreferences();

  const { pinned, saved } = useReorderFeeds(savedFeeds);

  const pathname = usePathname();

  if (savedFeeds.data) {
    if (savedFeeds.data.feeds.length === 0) {
      return <NoFeeds />;
    }

    const favs = pinned
      .map((uri) => savedFeeds.data.feeds.find((f) => f.uri === uri)!)
      .filter(Boolean);

    const all = sortableFeeds
      ? saved
          .map((uri) => savedFeeds.data.feeds.find((f) => f.uri === uri)!)
          .filter((x) => x && !x.pinned)
      : savedFeeds.data.feeds
          .filter((feed) => !feed.pinned)
          .sort((a, b) => a.displayName.localeCompare(b.displayName));

    return (
      <BottomSheetSectionList
        sections={[
          {
            title: "Favourites",
            data: favs,
          },
          {
            title: "All feeds",
            data: all,
          },
        ]}
        renderItem={({ item }) => (
          <FeedRow
            feed={item}
            onPress={dismiss}
            right={
              pathname ===
              `/profile/${item.creator.did}/feed/${item.uri
                .split("/")
                .pop()}` ? (
                <CircleDotIcon
                  size={20}
                  className={
                    theme.dark ? "text-neutral-200" : "text-neutral-400"
                  }
                />
              ) : (
                <></>
              )
            }
          />
        )}
        keyExtractor={(item) => item.uri}
        renderSectionHeader={({ section }) => (
          <SectionHeader title={section.title} />
        )}
        ListHeaderComponent={
          <LargeRow
            icon={<CloudIcon size={32} color="white" />}
            title="Following"
            subtitle="Posts from people you follow"
            style={{ backgroundColor: theme.colors.card }}
            onPress={dismiss}
            right={
              pathname === "/feeds/following" && (
                <CircleDotIcon
                  size={20}
                  className={
                    theme.dark ? "text-neutral-200" : "text-neutral-400"
                  }
                />
              )
            }
          />
        }
        ItemSeparatorComponent={() => (
          <ItemSeparator iconWidth="w-6" containerClassName="pr-4" />
        )}
      />
    );
  }

  return <QueryWithoutData query={savedFeeds} />;
};
