import {FlashList} from "@shopify/flash-list";
import {useRouter} from "expo-router";
import {useAtomValue, useSetAtom} from "jotai";
import {useDeferredValue, useMemo, useState} from "react";
import {ScrollView, StyleSheet, View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {Chip} from "@/components/Chip/Chip";
import {EmptyState} from "@/components/EmptyState/EmptyState";
import {SearchBar} from "@/components/SearchBar/SearchBar";
import {Text} from "@/components/Text/Text";
import {VideoItem} from "@/components/VideoItem/VideoItem";
import {COPY} from "@/constants/copy";
import {PATHS} from "@/constants/routes";
import {SPACE} from "@/constants/theme";
import type {VideoKind} from "@/models/video";
import {track} from "@/services/analytics";
import {searchCatalog} from "@/services/catalog";
import {pushRecentSearchAtom, recentSearchesAtom} from "@/stores/store";

type Filter = VideoKind | "all";

const FILTERS: {key: Filter; label: string}[] = [
    {key: "all", label: COPY.search.filters.all},
    {key: "video", label: COPY.search.filters.videos},
    {key: "short", label: COPY.search.filters.shorts},
];

const Search = () => {
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<Filter>("all");
    const recentSearches = useAtomValue(recentSearchesAtom);
    const pushRecentSearch = useSetAtom(pushRecentSearchAtom);
    const insets = useSafeAreaInsets();
    const router = useRouter();

    // Keeps typing responsive while the 3.6k item scan runs behind it.
    const deferredQuery = useDeferredValue(query);

    const results = useMemo(() => {
        const term = deferredQuery.trim();
        if (term.length < 2) return [];
        const found = searchCatalog(term, {kind: filter});
        track({name: "search", termLength: term.length, results: found.length});
        return found;
    }, [deferredQuery, filter]);

    const hasQuery = query.trim().length >= 2;

    return (
        <View style={[styles.screen, {paddingTop: insets.top + SPACE.xs}]}>
            <SearchBar
                value={query}
                onChangeText={setQuery}
                onSubmit={() => pushRecentSearch(query)}
                placeholder={COPY.search.placeholder}
            />

            <View style={styles.filterRow}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filters}
                >
                    {FILTERS.map(({key, label}) => (
                        <Chip
                            key={key}
                            label={label}
                            selected={filter === key}
                            onPress={() => setFilter(key)}
                        />
                    ))}
                </ScrollView>
            </View>

            {!hasQuery && recentSearches.length > 0 ? (
                <View style={styles.recent}>
                    <Text variant="micro" tone="faint">
                        {COPY.search.recent.toUpperCase()}
                    </Text>
                    <View style={styles.recentChips}>
                        {recentSearches.map((term) => (
                            <Chip
                                key={term}
                                label={term}
                                icon="history"
                                onPress={() => setQuery(term)}
                            />
                        ))}
                    </View>
                </View>
            ) : null}

            {hasQuery && results.length === 0 ? (
                <EmptyState
                    icon="magnify-close"
                    title={COPY.search.emptyTitle}
                    message={COPY.search.emptyHint}
                />
            ) : null}

            {!hasQuery && recentSearches.length === 0 ? (
                <EmptyState
                    icon="magnify"
                    title={COPY.search.idleTitle}
                    message={COPY.search.idleHint}
                />
            ) : null}

            {results.length > 0 ? (
                <>
                    <Text variant="micro" tone="faint" style={styles.count}>
                        {COPY.search.results(results.length).toUpperCase()}
                    </Text>
                    <FlashList
                        data={results}
                        keyExtractor={(item) => item.id}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({item}) => (
                            <VideoItem
                                item={item}
                                onPress={() => {
                                    pushRecentSearch(query);
                                    router.push(PATHS.VIDEO(item.id));
                                }}
                            />
                        )}
                        contentContainerStyle={{
                            paddingBottom: insets.bottom + SPACE.huge,
                        }}
                    />
                </>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    screen: {flex: 1},
    // The row wrapper stops the horizontal ScrollView from stretching its
    // children to the full remaining height of the screen.
    filterRow: {height: 40 + SPACE.lg, justifyContent: "center"},
    filters: {paddingHorizontal: SPACE.md, gap: SPACE.xs, alignItems: "center"},
    recent: {paddingHorizontal: SPACE.md, paddingTop: SPACE.xs, gap: SPACE.xs},
    recentChips: {flexDirection: "row", flexWrap: "wrap", gap: SPACE.xs},
    count: {paddingHorizontal: SPACE.md, paddingBottom: SPACE.xs},
});

export default Search;
