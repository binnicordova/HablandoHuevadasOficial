import {useAtom} from "jotai";
import {useCallback, useEffect, useRef, useState} from "react";
import {FlatList, View, type ViewToken} from "react-native";
import {VideoPlayer} from "@/components/VideoPlayer/VideoPlayer";
import {VideoPlayerPlaceholder} from "@/components/VideoPlayer/VideoPlayerPlaceholder";
import type {Video} from "@/models/video";
import {fetchShorts} from "@/services/service";
import {shortsAtom} from "@/stores/store";

const Shorts: React.FC = () => {
    const [shorts, setShorts] = useAtom(shortsAtom);
    const [currentVideo, setCurrentVideo] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const onViewableItemsChanged = useCallback(
        ({viewableItems}: {viewableItems: ViewToken[]}) => {
            if (viewableItems.length > 0) {
                const {item} = viewableItems[0] as {item: Video};
                setCurrentVideo(item.id);
            }
        },
        []
    );

    const viewabilityConfig = {
        itemVisiblePercentThreshold: 50,
    };

    const viewabilityConfigCallbackPairs = useRef([
        {viewabilityConfig, onViewableItemsChanged},
    ]);

    useEffect(() => {
        const loadShorts = async () => {
            try {
                const fetchedShorts = await fetchShorts();
                setShorts(fetchedShorts);
                if (fetchedShorts.length > 0) {
                    setCurrentVideo(fetchedShorts[0].id);
                }
            } finally {
                setLoading(false);
            }
        };
        loadShorts();
    }, [setShorts]);

    if (loading) {
        return (
            <View style={{flex: 1, backgroundColor: "black"}}>
                {[1, 2, 3, 4, 5].map((i) => (
                    <VideoPlayerPlaceholder key={i} />
                ))}
            </View>
        );
    }

    return (
        <FlatList
            data={shorts}
            renderItem={({item}) => (
                <VideoPlayer
                    videoId={item.id}
                    playing={currentVideo === item.id}
                    onStateChange={(event: string) => {
                        console.log(`Video ${item.id} state changed: ${event}`);
                    }}
                />
            )}
            keyExtractor={(item) => item.id}
            snapToAlignment="start"
            decelerationRate="fast"
            showsVerticalScrollIndicator={false}
            viewabilityConfigCallbackPairs={
                viewabilityConfigCallbackPairs.current
            }
            contentContainerStyle={{
                backgroundColor: "black",
            }}
        />
    );
};

export default Shorts;
