import YoutubeIframe from "react-native-youtube-iframe";

type VideoPlayerProps = {
    videoId: string | null;
    playing: boolean;
    onStateChange: (event: string) => void;
    height?: number;
    width?: number;
};

export const VideoPlayer = ({
    videoId,
    playing,
    onStateChange,
    height = 200,
    width: _width,
}: VideoPlayerProps) => {
    if (!videoId) {
        return null;
    }

    return (
        <YoutubeIframe
            height={height}
            play={playing}
            videoId={videoId}
            onChangeState={onStateChange}
        />
    );
};
