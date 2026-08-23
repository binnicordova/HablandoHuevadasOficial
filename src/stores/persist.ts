import AsyncStorage from "@react-native-async-storage/async-storage";
import {atom, type WritableAtom} from "jotai";

export type SetStateAction<T> = T | ((prev: T) => T);
export type PersistedAtom<T> = WritableAtom<T, [SetStateAction<T>], void> & {
    /**
     * Resolves once the stored value has been read, or found missing.
     *
     * Anything that *writes* at launch has to wait on this. The atom starts at
     * its default and fills in from storage a tick later, so a write that
     * lands in that window both persists the defaults over the user's real
     * settings and sets `dirty`, which cancels the hydration that would have
     * corrected it. Reads can race harmlessly; writes cannot.
     *
     * Only resolves once something has subscribed to the atom — hydration
     * starts on mount.
     */
    hydrated: Promise<void>;
};

/**
 * A small AsyncStorage-backed atom.
 *
 * jotai's `atomWithStorage` types an async storage as `T | Promise<T>`, and with
 * `getOnInit` it suspends the tree on first launch. Here the atom always starts
 * at `initial` synchronously and hydrates in `onMount`, so nothing ever blocks
 * the first paint. Writes made before hydration finishes win: hydration is
 * skipped once the user has already changed the value.
 */
export const persistedAtom = <T>(key: string, initial: T): PersistedAtom<T> => {
    const baseAtom = atom<T>(initial);
    let dirty = false;
    let settle: () => void = () => {};
    const hydrated = new Promise<void>((resolve) => {
        settle = resolve;
    });

    baseAtom.onMount = (setValue) => {
        AsyncStorage.getItem(key)
            .then((raw) => {
                if (dirty || raw == null) return;
                setValue(JSON.parse(raw) as T);
            })
            .catch(() => {
                /* corrupted or unavailable storage: keep the default */
            })
            .finally(settle);
    };

    const writable = atom(
        (get) => get(baseAtom),
        (get, set, update: SetStateAction<T>) => {
            const next =
                typeof update === "function"
                    ? (update as (prev: T) => T)(get(baseAtom))
                    : update;
            dirty = true;
            set(baseAtom, next);
            AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {
                /* best effort; state stays correct in memory */
            });
        }
    ) as PersistedAtom<T>;

    writable.hydrated = hydrated;
    return writable;
};
