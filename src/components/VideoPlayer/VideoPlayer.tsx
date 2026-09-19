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
    /**
     * Whether the webview is mounted at all.
     *
     * A paged feed keeps several pages alive, and each mounted iframe is a full
     * webview. Passing `false` for the pages that are out of reach keeps the
     * poster on screen and the memory free; the neighbour of the current page
     * should stay mounted so swiping into it starts instantly.
     */
    mounted?: boolean;
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
    mounted = true,
}: VideoPlayerProps) => {
    const playerRef = useRef<YoutubeIframeRef>(null);
    const colors = useTheme();
    /**
     * Whether the webview has booted a player — not whether the current clip is
     * showing. YouTube emits `onReady` exactly once per webview, so this can
     * only go false when the frame is torn down and rebuilt.
     */
    const [booted, setBooted] = useState(false);
    const seededRef = useRef<string | null>(null);

    // A remounted player (paged feed) boots from nothing, so the stale frame has
    // to go and the poster has to come back. The reset happens during render
    // rather than in an effect so the stale frame is never committed for a beat.
    const mountKeyRef = useRef(mounted);
    if (mountKeyRef.current !== mounted) {
        mountKeyRef.current = mounted;
        seededRef.current = null;
        if (booted) setBooted(false);
    }

    /*
     * A new id on a live player is not a boot: the library injects
     * `loadVideoById` into the same webview and YouTube swaps the video in
     * place. Nothing is hidden here on purpose — the embed runs its own
     * transition, and there is no second `onReady` coming that could ever
     * reveal the frame again. Only the resume seek is re-armed.
     */
    const videoIdRef = useRef(videoId);
    if (videoIdRef.current !== videoId) {
        videoIdRef.current = videoId;
        seededRef.current = null;
    }

    /** Resumes once per clip, from whichever signal arrives first. */
    const seek = useCallback(() => {
        if (startAt <= 5 || seededRef.current === videoId) return;
        seededRef.current = videoId;
        playerRef.current?.seekTo(startAt, true);
    }, [startAt, videoId]);

    const handleReady = useCallback(() => {
        setBooted(true);
        onReady?.();
        seek();
    }, [onReady, seek]);

    /*
     * The swapped-in clip gets no ready event, so its resume rides the first
     * state change instead. `buffering` lands before the first frame, which
     * keeps the jump invisible.
     */
    const handleStateChange = useCallback(
        (event: string) => {
            if (event === "buffering" || event === "playing") seek();
            onStateChange?.(event);
        },
        [onStateChange, seek]
    );

    useEffect(() => {
        if (!onProgress || !playing || !booted) return;
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
    }, [onProgress, playing, booted]);

    if (!videoId) {
        return null;
    }

    // Unmounted pages keep their cover so the feed still looks full while
    // scrolling fast past them.
    if (!mounted) {
        return (
            <View
                style={[
                    styles.container,
                    {height, backgroundColor: colors.sunken},
                    fill && styles.fillContainer,
                ]}
            >
                {poster ? (
                    <Image
                        source={poster}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                        transition={120}
                        cachePolicy="disk"
                    />
                ) : null}
            </View>
        );
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
            {poster && !booted ? (
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
                    onChangeState={handleStateChange}
                    initialPlayerParams={{
                        modestbranding: true,
                        rel: false,
                        controls: !fill,
                    }}
                    // Android blocks a scripted play() outright; the
                    // library's desktop user agent is the documented way
                    // around it. iOS is unaffected by the flag.
                    forceAndroidAutoplay={fill}
                    webViewProps={{
                        allowsInlineMediaPlayback: true,
                        /*
                         * The embed never scrolls -- its body is exactly the
                         * frame -- but an enabled web view scroll view still
                         * claims the vertical pan, and a paged feed needs that
                         * pan to reach the list underneath.
                         *
                         * `style` is deliberately not set here: webViewProps is
                         * spread over the library's own props, so passing one
                         * would drop `webViewStyle` and with it the crossfade
                         * out of the poster.
                         */
                        scrollEnabled: false,
                        bounces: false,
                    }}
                    webViewStyle={{
                        backgroundColor: "transparent",
                        opacity: booted ? 1 : 0,
                    }}
                />
            </View>
        </View>
    );
};
