import {View} from "react-native";
import {Placeholder} from "@/components/Placeholder/Placeholder";
import {RADII} from "@/constants/theme";
import {styles} from "./VideoItem.styles";

export const VideoItemPlaceholder = () => {
    return (
        <View style={styles.container}>
            <View style={styles.thumbnailWrap}>
                <Placeholder style={{width: "100%", height: "100%"}} />
            </View>
            <View style={styles.textContainer}>
                <Placeholder
                    style={{width: "85%", height: 20, borderRadius: RADII.xs}}
                />
                <Placeholder
                    style={{width: "35%", height: 14, borderRadius: RADII.xs}}
                />
            </View>
        </View>
    );
};
