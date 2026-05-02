import type React from "react";
import {useState} from "react";
import {
    ActivityIndicator,
    Image,
    Modal,
    Pressable,
    Share,
    StyleSheet,
    Text,
    View,
} from "react-native";

interface PromoModalProps {
    visible: boolean;
    onClose: () => void;
}

const APPLINK =
    "https://play.google.com/store/apps/details?id=com.hablandohuevadasoficial";

const PromoModal: React.FC<PromoModalProps> = ({visible, onClose}) => {
    const [isSharing, setIsSharing] = useState(false);

    const shareMessage = `🎉 Si disfrutas Hablando Huevadas Oficial, ayúdanos a crecer compartiéndola con tus amigos y familiares.

Descárgala aquí: ${APPLINK}

Tu apoyo hace la diferencia y nos impulsa a seguir mejorando la experiencia para toda la comunidad. 💙
#HablandoHuevadas #ComparteLaApp`;

    const handleShare = async () => {
        try {
            setIsSharing(true);
            await Share.share({message: shareMessage});
            onClose();
        } finally {
            setIsSharing(false);
        }
    };

    return (
        <Modal
            animationType="slide"
            transparent
            visible={visible}
            onRequestClose={onClose}
            presentationStyle="overFullScreen"
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable
                    style={styles.modalContainer}
                    onPress={(event) => event.stopPropagation()}
                >
                    <Pressable
                        style={styles.closeButton}
                        onPress={onClose}
                        accessibilityRole="button"
                        accessibilityLabel="Cerrar promoción"
                    >
                        <Text style={styles.closeButtonText}>×</Text>
                    </Pressable>

                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>Promo de comunidad</Text>
                    </View>

                    <Image
                        source={require("../../../assets/images/tour.png")}
                        style={styles.image}
                    />

                    <Text style={styles.title}>
                        Ayuda a que la comunidad crezca
                    </Text>
                    <Text style={styles.description}>
                        Comparte la app con tus amigos. Y participa por 3
                        entradas gratis para ti, tu esposa y tu amante...
                    </Text>

                    <View style={styles.benefits}>
                        <Text style={styles.bullet}>
                            • Más comunidad, más beneficios
                        </Text>
                        <Text style={styles.bullet}>
                            • Más usas la app, más ayudas a mejorarla
                        </Text>
                        <Text style={styles.bullet}>
                            • Más compartes, más posibilidades de que ganes
                        </Text>
                    </View>

                    <Text style={styles.joke}>
                        Cada share cuenta. Si te gusta el contenido, este es el
                        mejor momento para apoyar.
                    </Text>

                    <Pressable
                        style={({pressed}) => [
                            styles.primaryButton,
                            pressed && styles.primaryButtonPressed,
                            isSharing && styles.primaryButtonDisabled,
                        ]}
                        onPress={handleShare}
                        disabled={isSharing}
                        accessibilityRole="button"
                        accessibilityLabel="Compartir la app"
                    >
                        {isSharing ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.primaryButtonText}>
                                Compartir y sumar
                            </Text>
                        )}
                    </Pressable>

                    <Pressable
                        style={styles.secondaryButton}
                        onPress={onClose}
                        accessibilityRole="button"
                        accessibilityLabel="Ahora no"
                    >
                        <Text style={styles.secondaryButtonText}>Ahora no</Text>
                    </Pressable>
                    <Text
                        style={{
                            fontSize: 8,
                            opacity: 0.3,
                        }}
                    >
                        Sorteo sobre cada 1k usuarios nuevos activos por semana.
                        ¡Gracias por ser parte de esta comunidad!
                    </Text>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        padding: 20,
    },
    modalContainer: {
        width: "100%",
        maxWidth: 420,
        backgroundColor: "#fff",
        borderRadius: 20,
        padding: 20,
        alignItems: "center",
        borderWidth: 1,
        borderColor: "rgba(230, 57, 70, 0.12)",
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    closeButton: {
        position: "absolute",
        top: 12,
        right: 12,
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(29, 53, 87, 0.08)",
        zIndex: 1,
    },
    closeButtonText: {
        fontSize: 24,
        lineHeight: 24,
        color: "#1D3557",
        fontWeight: "700",
        marginTop: -2,
    },
    badge: {
        backgroundColor: "rgba(230, 57, 70, 0.1)",
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 999,
        marginBottom: 14,
    },
    badgeText: {
        color: "#E63946",
        fontSize: 12,
        fontWeight: "700",
        letterSpacing: 0.3,
        textTransform: "uppercase",
    },
    image: {
        width: 200,
        height: 150,
        resizeMode: "contain",
        marginBottom: 20,
    },
    title: {
        fontSize: 23,
        fontWeight: "bold",
        color: "#E63946",
        textAlign: "center",
        marginBottom: 12,
    },
    description: {
        fontSize: 16,
        color: "#1D3557",
        textAlign: "center",
        marginBottom: 16,
        lineHeight: 23,
    },
    benefits: {
        width: "100%",
        backgroundColor: "#F8FAFC",
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 14,
        marginBottom: 14,
    },
    bullet: {
        fontSize: 15,
        color: "#1D3557",
        lineHeight: 22,
        marginBottom: 4,
    },
    joke: {
        fontSize: 14,
        color: "#457B9D",
        textAlign: "center",
        marginBottom: 18,
        lineHeight: 20,
    },
    primaryButton: {
        backgroundColor: "#E63946",
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 20,
        width: "100%",
        alignItems: "center",
    },
    primaryButtonPressed: {
        opacity: 0.9,
        transform: [{scale: 0.99}],
    },
    primaryButtonDisabled: {
        opacity: 0.8,
    },
    primaryButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "bold",
    },
    secondaryButton: {
        marginTop: 10,
        paddingVertical: 8,
        paddingHorizontal: 20,
    },
    secondaryButtonText: {
        color: "#457B9D",
        fontSize: 14,
        fontWeight: "600",
    },
});

export default PromoModal;
