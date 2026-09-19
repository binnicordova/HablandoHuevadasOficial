import {FlashList} from "@shopify/flash-list";
import {useRouter} from "expo-router";
import {useAtomValue} from "jotai";
import {useCallback, useMemo, useState} from "react";
import {StyleSheet, View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {EmptyState} from "@/components/EmptyState/EmptyState";
import {FloatingActionButton} from "@/components/FloatingActionButton/FloatingActionButton";
import {
    KindFilter,
    type KindFilterValue,
} from "@/components/KindFilter/KindFilter";
import {SectionHeader} from "@/components/SectionHeader/SectionHeader";
import {Text} from "@/components/Text/Text";
import {VideoItem} from "@/components/VideoItem/VideoItem";
import {VideoRail} from "@/components/VideoRail/VideoRail";
import {COPY} from "@/constants/copy";
import {PATHS} from "@/constants/routes";
import {SPACE} from "@/constants/theme";
import {useOpenItem} from "@/hooks/useOpenItem";
import {track} from "@/services/analytics";
import {railPool} from "@/services/recommendations";
import {
    favoriteItemsAtom,
    favoriteRailsAtom,
    watchProgressAtom,
} from "@/stores/store";

/**
 * Guardados.
 *
 * A favourites screen that only lists favourites is a dead end: everything on
 * it has already been seen, and an empty one is a closed door. So the saved
 * list is only the top half — under it sit the same rails Inicio uses, built
 * from the same engine, because what someone saves is the sharpest description
 * of what they want next. Empty or full, there is always something to press.
 */
const Favorites = () => {
    const favorites = useAtomValue(favoriteItemsAtom);
    const rails = useAtomValue(favoriteRailsAtom);
    const progressById = useAtomValue(watchProgressAtom);

    const insets = useSafeAreaInsets();
    const router = useRouter();
    const open = useOpenItem();
    const [filter, setFilter] = useState<KindFilterValue>("all");

    const visible = useMemo(
        () =>
            filter === "all"
                ? favorites
                : favorites.filter((item) => item.kind === filter),
        [favorites, filter]
    );

    /**
     * Shuffle prefers what the user actually saved — that is the whole promise
     * of this screen — and only falls back to the rails when the list is empty.
     */
    const shufflePool = useMemo(
        () => (favorites.length > 0 ? favorites : railPool(rails)),
        [favorites, rails]
    );

    const shuffle = useCallback(() => {
        if (shufflePool.length === 0) return;
        const pick =
            shufflePool[Math.floor(Math.random() * shufflePool.length)];
        track({
            name: "rail_open",
            rail: "favorites:shuffle",
            videoId: pick.id,
            position: 0,
        });
        open(pick);
    }, [open, shufflePool]);

    const header = (
        <View>
            <View style={[styles.heading, {paddingTop: insets.top + SPACE.md}]}>
                <Text variant="display">{COPY.favorites.title}</Text>
                <Text variant="caption" tone="faint">
                    {COPY.favorites.count(favorites.length)}
                </Text>
            </View>

            {favorites.length > 0 ? (
                <KindFilter value={filter} onChange={setFilter} />
            ) : null}

            {favorites.length === 0 ? (
                <EmptyState
                    icon="heart-broken-outline"
                    title={COPY.favorites.emptyTitle}
                    message={COPY.favorites.emptyBody}
                    actionLabel={COPY.favorites.emptyAction}
                    onAction={() => router.push(PATHS.HOME)}
                />
            ) : null}

            {favorites.length > 0 && visible.length === 0 ? (
                <EmptyState
                    icon="filter-variant-remove"
                    title={COPY.favorites.emptyFilterTitle}
                    message={COPY.favorites.emptyFilterBody}
                />
            ) : null}
        </View>
    );

    const footer = (
        <View>
            {rails.length > 0 ? (
                <SectionHeader title={COPY.favorites.rails} />
            ) : null}
            {rails.map((entry) => (
                <VideoRail
                    key={entry.id}
                    rail={entry}
                    progressById={progressById}
                    onPress={open}
                    actionLabel={COPY.rails.seeAll}
                    onAction={
                        entry.action === "shorts"
                            ? () => router.push(PATHS.SHORTS)
                            : undefined
                    }
                />
            ))}
        </View>
    );

    return (
        <View style={styles.screen}>
            <FlashList
                data={visible}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={header}
                ListFooterComponent={footer}
                renderItem={({item}) => (
                    <VideoItem
                        item={item}
                        onPress={open}
                        progress={progressById.get(item.id)}
                    />
                )}
                contentContainerStyle={{
                    paddingBottom: insets.bottom + SPACE.huge,
                }}
            />
            {shufflePool.length > 0 ? (
                <FloatingActionButton
                    onPress={shuffle}
                    icon="shuffle-variant"
                    label={COPY.favorites.shuffle}
                    bottom={insets.bottom + SPACE.xxl}
                />
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    screen: {flex: 1},
    heading: {paddingHorizontal: SPACE.md, gap: 2, marginBottom: SPACE.xs},
});

export default Favorites;
