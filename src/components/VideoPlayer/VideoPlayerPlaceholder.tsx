import {Placeholder} from "@/components/Placeholder/Placeholder";
import {RADII} from "@/constants/theme";

export const VideoPlayerPlaceholder = ({height = 220}: {height?: number}) => {
    return (
        <Placeholder
            style={{width: "100%", height, borderRadius: RADII.none}}
        />
    );
};
