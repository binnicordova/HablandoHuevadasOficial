import {FlashList} from "@shopify/flash-list";
import {useRouter} from "expo-router";
import {useAtom} from "jotai";
import {useEffect, useState} from "react";
import {Image, View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {FloatingActionButton} from "@/components/FloatingActionButton/FloatingActionButton";
import {VideoItem} from "@/components/VideoItem/VideoItem";
import {VideoItemPlaceholder} from "@/components/VideoItem/VideoItemPlaceholder";
import {VideoPlayer} from "@/components/VideoPlayer/VideoPlayer";
import {VideoPlayerPlaceholder} from "@/components/VideoPlayer/VideoPlayerPlaceholder";
import type {Video as VideoType} from "@/models/video";
import {fetchVideos} from "@/services/service";
import {videosAtom} from "@/stores/store";

const getYoutubeVideoId = (url: string) => {
    const regex =
        /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/ ]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
};

const Home: React.FC = () => {
    const [videos, setVideos] = useAtom(videosAtom);
    const [currentVideo, setCurrentVideo] = useState<VideoType | null>(null);
    const [playing, setPlaying] = useState(false);
    const [loading, setLoading] = useState(true);
    const insets = useSafeAreaInsets();
    const router = useRouter();

    useEffect(() => {
        const loadVideos = async () => {
            try {
                const fetchedVideos = await fetchVideos();
                setVideos(fetchedVideos);
                if (fetchedVideos.length > 0) {
                    setCurrentVideo(fetchedVideos[0]);
                    setPlaying(true);
                }
            } finally {
                setLoading(false);
            }
        };
        loadVideos();
    }, [setVideos]);

    const handleVideoPress = (video: VideoType) => {
        setCurrentVideo(video);
        setPlaying(true);
    };

    const videoId = currentVideo ? getYoutubeVideoId(currentVideo.link) : null;

    if (loading) {
        return (
            <View style={{flex: 1, paddingTop: insets.top}}>
                <VideoPlayerPlaceholder />
                <View style={{padding: 10}}>
                    {[1, 2, 3, 4, 5].map((i) => (
                        <VideoItemPlaceholder key={i} />
                    ))}
                </View>
            </View>
        );
    }

    return (
        <View style={{flex: 1}}>
            <Image
                src={currentVideo?.thumbnail || ""}
                style={{
                    height: insets.top,
                    width: "100%",
                    resizeMode: "cover",
                    filter: "blur(10px)",
                }}
                blurRadius={10}
            />
            <VideoPlayer
                videoId={videoId}
                playing={playing}
                onStateChange={(event: string) => {
                    if (event === "ended") {
                        setPlaying(false);
                    }
                }}
                height={200}
            />
            <FlashList
                data={videos}
                renderItem={({item}) => {
                    return (
                        <VideoItem
                            item={item as VideoType}
                            onPress={handleVideoPress}
                        />
                    );
                }}
                contentContainerStyle={{
                    paddingBottom: insets.bottom,
                    paddingLeft: insets.left,
                    paddingRight: insets.right,
                }}
                estimatedItemSize={200}
            />
            <FloatingActionButton onPress={() => router.push("shorts")} />
        </View>
    );
};

export default Home;
