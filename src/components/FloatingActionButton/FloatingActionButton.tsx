import {Image, TouchableOpacity} from "react-native";
import {styles} from "./FloatingActionButton.styles";

type FloatingActionButtonProps = {
    onPress: () => void;
};

export const FloatingActionButton = ({onPress}: FloatingActionButtonProps) => {
    return (
        <TouchableOpacity
            style={styles.container}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel="Acción principal"
        >
            <Image
                source={require("../../../assets/icon.png")}
                style={styles.icon}
            />
        </TouchableOpacity>
    );
};
