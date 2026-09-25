import {useIsFocused} from "expo-router";
import {useSetAtom} from "jotai";
import {useCallback, useEffect, useRef} from "react";
import {View} from "react-native";
import {heroFocusedAtom} from "@/stores/player";
import {usePlayerUI} from "./PlayerUIProvider";

/** Inicio's normal hero height. Taller for the rare notification/old link
 *  that points at a short's id instead of an episode's. */
export const HERO_HEIGHT = 220;

type HeroSlotProps = {height?: number};

/**
 * The spacer Inicio renders where the hero player should appear inline. It
 * draws nothing itself — the actual `<VideoPlayer>` is a singleton mounted
 * once at the app root (`GlobalPlayerHost`) and painted on top of
 * everything, so it can survive Inicio scrolling it out of view or another
 * screen taking over the foreground without ever remounting.
 *
 * This just reserves the layout space and publishes where that space sits in
 * Inicio's *unscrolled* content (`inlineRect`) — the host combines that with
 * the live scroll offset every frame to draw the player in the right spot,
 * or to know it has scrolled past and should float free instead.
 */
export const HeroSlot = ({height = HERO_HEIGHT}: HeroSlotProps) => {
    const isFocused = useIsFocused();
    const setFocused = useSetAtom(heroFocusedAtom);
    const {inlineRect, scrollY} = usePlayerUI();
    const anchorRef = useRef<View>(null);

    const measure = useCallback(() => {
        anchorRef.current?.measureInWindow((x, y, width) => {
            inlineRect.value = {x, y: y + scrollY.value, width, height};
        });
    }, [height, inlineRect, scrollY]);

    useEffect(() => {
        setFocused(isFocused);
        if (isFocused) measure();
    }, [isFocused, measure, setFocused]);

    return <View ref={anchorRef} onLayout={measure} style={{height}} />;
};
