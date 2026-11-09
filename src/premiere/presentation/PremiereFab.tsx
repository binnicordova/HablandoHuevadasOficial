import {type ReactNode, useCallback, useEffect, useRef, useState} from "react";
import {View} from "react-native";
import {FloatingActionButton} from "@/components/FloatingActionButton/FloatingActionButton";
import {Text} from "@/components/Text/Text";
import {COPY} from "@/constants/copy";
import {usePremiere} from "@/premiere/application/usePremiere";
import {useTheme} from "@/theme/colors";
import {BUBBLE_GAP, FAB_SIZE, styles} from "./PremiereFab.styles";

const CAPTION_MS = 3000;

type PremiereFabProps = {
    /** Same `bottom` the plain fire button used, so nothing shifts. */
    bottom: number;
    /** Only ever called once the premiere is live. */
    onPlay: (id: string) => void;
    /** Shown while there is no pending premiere. */
    fallback?: ReactNode;
};

/**
 * The fire button while a premiere is pending. Until it starts it is a
 * countdown that explains itself on tap and never loads the player; once it
 * is live it turns into the green light for it.
 */
export const PremiereFab = ({bottom, onPlay, fallback}: PremiereFabProps) => {
    const view = usePremiere();
    const colors = useTheme();
    const [captionVisible, setCaptionVisible] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearTimer = useCallback(() => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
    }, []);
    useEffect(() => clearTimer, [clearTimer]);
    // The explanation is about a pending start; it makes no sense once live.
    useEffect(() => {
        if (view?.phase === "live") {
            clearTimer();
            setCaptionVisible(false);
        }
    }, [view?.phase, clearTimer]);

    const explain = useCallback(() => {
        clearTimer();
        setCaptionVisible(true);
        timer.current = setTimeout(() => setCaptionVisible(false), CAPTION_MS);
    }, [clearTimer]);

    if (view === null) return <>{fallback}</>;

    const live = view.phase === "live";
    const caption = view.whenLabel
        ? COPY.premiere.caption(view.whenLabel)
        : COPY.premiere.captionSoon;

    return (
        <>
            {captionVisible ? (
                <View
                    accessibilityLiveRegion="polite"
                    pointerEvents="none"
                    style={[
                        styles.bubble,
                        {
                            bottom: bottom + FAB_SIZE + BUBBLE_GAP,
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <Text variant="caption">{caption}</Text>
                </View>
            ) : null}
            <FloatingActionButton
                icon="fire"
                text={view.label}
                label={view.a11yLabel}
                bottom={bottom}
                tint={live ? colors.accent : colors.hot}
                tintText={live ? colors.accentText : colors.text}
                pulse={view.phase === "imminent" || live ? "urgent" : "calm"}
                onPress={live ? () => onPlay(view.id) : explain}
            />
        </>
    );
};
