/** Public store listing, used as the destination of every share. */
export const STORE_URL_ANDROID =
    "https://play.google.com/store/apps/details?id=com.hablandohuevadasoficial";
export const STORE_URL_IOS =
    "https://apps.apple.com/app/hablando-huevadas/id0000000000";

/** Served by Firebase Hosting from `hosting/`; the same URL is in both stores. */
export const PRIVACY_POLICY_URL =
    "https://hablandohuevadass.web.app/privacidad";
export const SUPPORT_EMAIL = "llaapp.solutions@gmail.com";

/** YouTube channel, used for the "ver más" fallback. */
export const CHANNEL_URL = "https://www.youtube.com/@HablandoHuevadas";

/**
 * Every shared link carries a campaign tag so Play Console / App Store Connect
 * can attribute installs back to the in-app share loop.
 */
export const SHARE_CAMPAIGN = "app_share";

/**
 * Text-to-speech service (the `voiceApi` Firebase function). Empty means the
 * chat tab shows its "coming soon" state instead of failing on every message.
 * Looks like https://us-east1-<project>.cloudfunctions.net/voiceApi
 */
export const VOICE_API_URL = process.env.EXPO_PUBLIC_VOICE_API_URL ?? "";
export const VOICE_API_KEY = process.env.EXPO_PUBLIC_VOICE_API_KEY ?? "";

/**
 * DeepSeek writes each reply inside the app, in the selected personaje's
 * style. The key is inlined into the bundle at build time, so it is readable
 * by anyone with the app: see deepseekScriptWriter.
 */
export const DEEPSEEK_API_KEY = process.env.EXPO_PUBLIC_DEEPSEEK_API_KEY ?? "";
export const DEEPSEEK_MODEL =
    process.env.EXPO_PUBLIC_DEEPSEEK_MODEL ?? "deepseek-chat";

/**
 * Public, static catalog published weekly to Firebase Storage under `public/`
 * (see .github/workflows/update-videos.yml). Setting it to an empty string
 * disables downloads and the app stays on the dataset bundled with it.
 */
export const CATALOG_URL =
    process.env.EXPO_PUBLIC_CATALOG_URL ??
    "https://firebasestorage.googleapis.com/v0/b/hablandohuevadass.firebasestorage.app/o/public%2Fdata.json?alt=media";
