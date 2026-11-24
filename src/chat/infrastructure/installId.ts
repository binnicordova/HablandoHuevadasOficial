import AsyncStorage from "@react-native-async-storage/async-storage";
import {STORAGE_ID} from "@/constants/storage";

let cached: string | null = null;

const randomId = (): string => {
    let out = "";
    for (let i = 0; i < 32; i += 1)
        out += Math.floor(Math.random() * 16).toString(16);
    return out;
};

/**
 * An anonymous id the server rate-limits on. Made once, kept on the device,
 * tied to no account. It is not a secret and not an identity.
 */
export const getInstallId = async (): Promise<string> => {
    if (cached) return cached;
    try {
        const stored = await AsyncStorage.getItem(STORAGE_ID.chatInstall);
        if (stored) {
            cached = stored;
            return stored;
        }
    } catch {
        /* unreadable storage: fall through to a fresh id */
    }
    cached = randomId();
    AsyncStorage.setItem(STORAGE_ID.chatInstall, cached).catch(() => {});
    return cached;
};
