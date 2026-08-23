import {FlashList} from "@shopify/flash-list";
import {useAtomValue, useSetAtom} from "jotai";
import {useCallback, useDeferredValue, useMemo, useState} from "react";
import {StyleSheet, View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {Chip} from "@/components/Chip/Chip";
import {EmptyState} from "@/components/EmptyState/EmptyState";
import {
    KindFilter,
    type KindFilterValue,
} from "@/components/KindFilter/KindFilter";
import {SearchBar} from "@/components/SearchBar/SearchBar";
import {SectionHeader} from "@/components/SectionHeader/SectionHeader";
import {Text} from "@/components/Text/Text";
import {VideoItem} from "@/components/VideoItem/VideoItem";
import {COPY} from "@/constants/copy";
import {SPACE} from "@/constants/theme";
import {useOpenItem} from "@/hooks/useOpenItem";
import type {CatalogItem} from "@/models/video";
import {track} from "@/services/analytics";
import {searchCatalog} from "@/services/catalog";
import {
    pushRecentSearchAtom,
    recentSearchesAtom,
    shortsCatalogAtom,
    videosAtom,
    watchProgressAtom,
} from "@/stores/store";

/** A query shorter than this is not a search, it is a typo in progress. */
const MIN_QUERY = 2;

/**
 * Buscar is also the catalog.
 *
 * An empty search box used to be a dead screen with a "busca algo" placard on
 * it, while the full 535-episode list sat at the bottom of Inicio where it
 * pushed every recommendation off the screen. Both problems have the same fix:
 * the list lives here and shows by default, and typing filters it. Search is
 * the browse surface — no query is just the unfiltered view of it.
 */
const Search = () => {
    const videos = useAtomValue(videosAtom);
    const shorts = useAtomValue(shortsCatalogAtom);
    const progressById = useAtomValue(watchProgressAtom);
    const recentSearches = useAtomValue(recentSearchesAtom);
    const pushRecentSearch = useSetAtom(pushRecentSearchAtom);

    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<KindFilterValue>("all");
    const insets = useSafeAreaInsets();
    const openItem = useOpenItem();

    // Keeps typing responsive while the 3.6k item scan runs behind it.
    const deferredQuery = useDeferredValue(query);
    const term = deferredQuery.trim();
    const hasQuery = term.length >= MIN_QUERY;

    const results = useMemo(() => {
        if (term.length < MIN_QUERY) return [];
        const found = searchCatalog(term, {kind: filter});
        track({name: "search", termLength: term.length, results: found.length});
        return found;
    }, [term, filter]);

    /**
     * The default list. Catalog order is newest first, which is the order
     * someone browsing a podcast back catalog expects.
     */
    const browse = useMemo((): CatalogItem[] => {
        if (filter === "video") return videos;
        if (filter === "short") return shorts;
        return [...videos, ...shorts];
    }, [filter, videos, shorts]);

    const data = hasQuery ? results : browse;

    const open = useCallback(
        (item: CatalogItem) => {
            if (hasQuery) pushRecentSearch(query);
            openItem(item);
        },
        [hasQuery, openItem, pushRecentSearch, query]
    );

    const header = (
        <View>
            {!hasQuery && recentSearches.length > 0 ? (
                <View style={styles.recent}>
                    <Text variant="micro" tone="faint">
                        {COPY.search.recent.toUpperCase()}
                    </Text>
                    <View style={styles.recentChips}>
                        {recentSearches.map((entry) => (
                            <Chip
                                key={entry}
                                label={entry}
                                icon="history"
                                onPress={() => setQuery(entry)}
                            />
                        ))}
                    </View>
                </View>
            ) : null}

            {hasQuery ? (
                <Text variant="micro" tone="faint" style={styles.count}>
                    {COPY.search.results(results.length).toUpperCase()}
                </Text>
            ) : (
                <SectionHeader
                    title={COPY.catalog.title[filter]}
                    subtitle={COPY.catalog.subtitle(browse.length)}
                />
            )}
        </View>
    );

    return (
        <View style={[styles.screen, {paddingTop: insets.top + SPACE.xs}]}>
            <SearchBar
                value={query}
                onChangeText={setQuery}
                onSubmit={() => pushRecentSearch(query)}
                placeholder={COPY.search.placeholder}
            />

            <KindFilter value={filter} onChange={setFilter} />

            <FlashList
                data={data}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                ListHeaderComponent={header}
                ListEmptyComponent={
                    hasQuery ? (
                        <EmptyState
                            icon="magnify-close"
                            title={COPY.search.emptyTitle}
                            message={COPY.search.emptyHint}
                        />
                    ) : null
                }
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
        </View>
    );
};

const styles = StyleSheet.create({
    screen: {flex: 1},
    recent: {paddingHorizontal: SPACE.md, paddingTop: SPACE.xs, gap: SPACE.xs},
    recentChips: {flexDirection: "row", flexWrap: "wrap", gap: SPACE.xs},
    count: {paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm},
});

export default Search;
