/** Public store listing, used as the destination of every share. */
export const STORE_URL_ANDROID =
    "https://play.google.com/store/apps/details?id=com.hablandohuevadasoficial";
export const STORE_URL_IOS =
    "https://apps.apple.com/app/hablando-huevadas/id0000000000";

/** YouTube channel, used for the "ver más" fallback. */
export const CHANNEL_URL = "https://www.youtube.com/@HablandoHuevadas";

/**
 * Every shared link carries a campaign tag so Play Console / App Store Connect
 * can attribute installs back to the in-app share loop.
 */
export const SHARE_CAMPAIGN = "app_share";

/**
 * Public, static catalog published weekly to Firebase Storage under `public/`
 * (see .github/workflows/update-videos.yml). Setting it to an empty string
 * disables downloads and the app stays on the dataset bundled with it.
 */
export const CATALOG_URL =
    process.env.EXPO_PUBLIC_CATALOG_URL ??
    "https://firebasestorage.googleapis.com/v0/b/hablandohuevadass.firebasestorage.app/o/public%2Fdata.json?alt=media";
