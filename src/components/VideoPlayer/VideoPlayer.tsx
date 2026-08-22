import {Image} from "expo-image";
import {useCallback, useEffect, useRef, useState} from "react";
import {StyleSheet, View} from "react-native";
import YoutubeIframe, {
    type YoutubeIframeRef,
} from "react-native-youtube-iframe";
import {useTheme} from "@/theme/colors";
import {styles} from "./VideoPlayer.styles";

type VideoPlayerProps = {
    videoId: string | null;
    playing: boolean;
    onStateChange?: (event: string) => void;
    /** Seconds to resume from. Applied once, when the player becomes ready. */
    startAt?: number;
    /** Polled roughly every 5s while playing, used to persist resume position. */
    onProgress?: (positionSeconds: number, durationSeconds: number) => void;
    onReady?: () => void;
    height?: number;
    width?: number;
    /** Cover shown behind the player until the first frame arrives. */
    poster?: string | null;
    /**
     * Fills a full-screen page edge to edge. The YouTube embed is always 16:9
     * and pillarboxes vertical sources, so the iframe is rendered wider than
     * the viewport and centred, cropping the bars away.
     */
    fill?: boolean;
};

const PROGRESS_INTERVAL_MS = 5000;
const YOUTUBE_ASPECT = 16 / 9;

export const VideoPlayer = ({
    videoId,
    playing,
    onStateChange,
    startAt = 0,
    onProgress,
    onReady,
    height = 220,
    width,
    poster,
    fill = false,
}: VideoPlayerProps) => {
    const playerRef = useRef<YoutubeIframeRef>(null);
    const colors = useTheme();
    const [ready, setReady] = useState(false);
    const seededRef = useRef<string | null>(null);

    useEffect(() => {
        setReady(false);
        seededRef.current = null;
    }, []);

    const handleReady = useCallback(() => {
        setReady(true);
        onReady?.();
        if (startAt > 5 && seededRef.current !== videoId) {
            seededRef.current = videoId;
            playerRef.current?.seekTo(startAt, true);
        }
    }, [onReady, startAt, videoId]);

    useEffect(() => {
        if (!onProgress || !playing || !ready) return;
        const interval = setInterval(async () => {
            try {
                const [position, duration] = await Promise.all([
                    playerRef.current?.getCurrentTime(),
                    playerRef.current?.getDuration(),
                ]);
                if (typeof position === "number") {
                    onProgress(
                        position,
                        typeof duration === "number" ? duration : 0
                    );
                }
            } catch {
                /* the webview went away mid-poll */
            }
        }, PROGRESS_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [onProgress, playing, ready]);

    if (!videoId) {
        return null;
    }

    const frameWidth = fill ? Math.ceil(height * YOUTUBE_ASPECT) : width;

    return (
        <View
            style={[
                styles.container,
                {height, backgroundColor: colors.sunken},
                fill && styles.fillContainer,
            ]}
        >
            {poster && !ready ? (
                <Image
                    source={poster}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={120}
                    cachePolicy="disk"
                />
            ) : null}
            <View style={fill ? {width: frameWidth} : styles.flexFull}>
                <YoutubeIframe
                    ref={playerRef}
                    height={height}
                    width={frameWidth}
                    play={playing}
                    videoId={videoId}
                    onReady={handleReady}
                    onChangeState={onStateChange}
                    initialPlayerParams={{
                        modestbranding: true,
                        rel: false,
                        controls: !fill,
                    }}
                    webViewProps={{
                        allowsInlineMediaPlayback: true,
                        style: {backgroundColor: "transparent"},
                    }}
                    webViewStyle={{
                        backgroundColor: "transparent",
                        opacity: ready ? 1 : 0,
                    }}
                />
            </View>
        </View>
    );
};
