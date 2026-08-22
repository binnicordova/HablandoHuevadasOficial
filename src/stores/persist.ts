import AsyncStorage from "@react-native-async-storage/async-storage";
import {atom, type WritableAtom} from "jotai";

export type SetStateAction<T> = T | ((prev: T) => T);
export type PersistedAtom<T> = WritableAtom<T, [SetStateAction<T>], void>;

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

    baseAtom.onMount = (setValue) => {
        AsyncStorage.getItem(key)
            .then((raw) => {
                if (dirty || raw == null) return;
                setValue(JSON.parse(raw) as T);
            })
            .catch(() => {
                /* corrupted or unavailable storage: keep the default */
            });
    };

    return atom(
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
    );
};
