import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import {Platform, Share} from "react-native";
import {COPY} from "@/constants/copy";
import {
    SHARE_CAMPAIGN,
    STORE_URL_ANDROID,
    STORE_URL_IOS,
} from "@/constants/env";
import type {CatalogItem} from "@/models/video";
import {displayTitle} from "@/utils/format";
import {successFeedback} from "@/utils/haptics";
import {watchUrl} from "@/utils/youtube";

export type ShareSource =
    | "home"
    | "player"
    | "shorts"
    | "detail"
    | "favorites"
    | "streak"
    | "promo";

/**
 * Store link tagged with the campaign + the clip that produced the share, so
 * installs can be attributed back to individual pieces of content.
 */
export const storeUrl = (source: ShareSource, contentId?: string): string => {
    const referrer = [
        `utm_source=${SHARE_CAMPAIGN}`,
        `utm_medium=${source}`,
        contentId ? `utm_content=${contentId}` : null,
    ]
        .filter(Boolean)
        .join("&");

    if (Platform.OS === "ios") {
        return `${STORE_URL_IOS}?${referrer}`;
    }
    return `${STORE_URL_ANDROID}&referrer=${encodeURIComponent(referrer)}`;
};

/** Deep link back into the app, used when the recipient already installed it. */
export const deepLink = (id: string): string =>
    Linking.createURL(`/video/${id}`);

export const buildShareMessage = (
    item: CatalogItem,
    source: ShareSource = "player"
): string => {
    return COPY.share.message(
        displayTitle(item),
        watchUrl(item.id, item.kind),
        storeUrl(source, item.id)
    );
};

/**
 * Opens the OS share sheet. The user picks the destination and confirms there,
 * so nothing leaves the device without an explicit tap.
 */
export const shareVideo = async (
    item: CatalogItem,
    source: ShareSource = "player"
): Promise<boolean> => {
    try {
        const result = await Share.share(
            {
                message: buildShareMessage(item, source),
                ...(Platform.OS === "ios"
                    ? {url: watchUrl(item.id, item.kind)}
                    : {}),
            },
            {dialogTitle: COPY.share.sheetTitle}
        );
        const shared = result.action === Share.sharedAction;
        if (shared) successFeedback();
        return shared;
    } catch {
        return false;
    }
};

export const shareStreak = async (days: number): Promise<boolean> => {
    try {
        const result = await Share.share({
            message: `${COPY.me.streakShareMessage(days)}\n\n${storeUrl("streak")}`,
        });
        return result.action === Share.sharedAction;
    } catch {
        return false;
    }
};

/** WhatsApp is the dominant sharing channel in LatAm, so it gets its own path. */
export const shareToWhatsApp = async (
    item: CatalogItem,
    source: ShareSource = "player"
): Promise<boolean> => {
    const url = `whatsapp://send?text=${encodeURIComponent(
        buildShareMessage(item, source)
    )}`;
    try {
        const supported = await Linking.canOpenURL(url);
        if (!supported) return shareVideo(item, source);
        await Linking.openURL(url);
        successFeedback();
        return true;
    } catch {
        return shareVideo(item, source);
    }
};

export const copyLink = async (
    item: CatalogItem,
    source: ShareSource = "player"
): Promise<boolean> => {
    try {
        await Clipboard.setStringAsync(buildShareMessage(item, source));
        successFeedback();
        return true;
    } catch {
        return false;
    }
};

export const openExternal = async (url: string): Promise<void> => {
    try {
        await Linking.openURL(url);
    } catch {
        /* the OS has no handler; nothing useful to do */
    }
};
