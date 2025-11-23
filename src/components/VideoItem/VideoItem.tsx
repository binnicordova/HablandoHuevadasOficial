import {Image, Pressable, View} from "react-native";
import {Text} from "@/components/Text/Text";
import type {Video} from "@/models/video";
import {formatViews} from "@/utils/format";
import {styles} from "./VideoItem.styles";

type VideoItemProps = {
    item: Video;
    onPress: (item: Video) => void;
};

export const VideoItem = ({item, onPress}: VideoItemProps) => {
    return (
        <Pressable
            style={styles.container}
            accessibilityRole="button"
            accessibilityLabel={`Reproducir video: ${item.title}`}
            accessibilityHint="Presiona para reproducir este video"
            onPress={() => onPress(item)}
        >
            {item.thumbnail && (
                <Image
                    source={{uri: item.thumbnail}}
                    style={styles.thumbnail}
                />
            )}
            <View style={styles.textContainer}>
                <Text type="label" style={{fontWeight: "bold"}}>
                    {item.title}
                </Text>
                <View style={styles.infoContainer}>
                    <Text type="caption">{formatViews(item.view_count)}</Text>
                    <Text type="caption">{item.duration_string}</Text>
                </View>
            </View>
        </Pressable>
    );
};
