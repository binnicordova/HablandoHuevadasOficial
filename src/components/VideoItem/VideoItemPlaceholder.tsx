import {View} from "react-native";
import {Placeholder} from "@/components/Placeholder/Placeholder";
import {styles} from "./VideoItem.styles";

export const VideoItemPlaceholder = () => {
    return (
        <View style={[styles.container]}>
            <View style={[styles.thumbnail, {overflow: "hidden"}]}>
                <Placeholder style={{width: "100%", height: "100%"}} />
            </View>
            <View style={styles.textContainer}>
                <Placeholder
                    style={{
                        width: "80%",
                        height: 20,
                        borderRadius: 4,
                    }}
                />
                <View style={styles.infoContainer}>
                    <Placeholder
                        style={{width: "30%", height: 16, borderRadius: 4}}
                    />
                    <Placeholder
                        style={{width: "20%", height: 16, borderRadius: 4}}
                    />
                </View>
            </View>
        </View>
    );
};
