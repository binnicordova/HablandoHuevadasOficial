import {createStore, type PrimitiveAtom} from "jotai";
import type {CatalogItem} from "@/models/video";
import {
    premiereLockedIdAtom,
    premiereViewAtom,
} from "@/premiere/application/premiereAtoms";
import {videosAtom} from "@/stores/store";

// The real atom reads the whole catalog; a plain atom is all this needs.
jest.mock("@/stores/store", () => {
    const {atom} = require("jotai");
    return {videosAtom: atom([])};
});

const NOW = Date.parse("2026-11-08T19:00:00-05:00");
const SEC = 1000;
const MIN = 60 * SEC;

const video = (extra: Partial<CatalogItem>): CatalogItem => ({
    id: "premiere",
    link: "https://www.youtube.com/watch?v=premiere",
    title: "premiere",
    view_count: null,
    thumbnail: null,
    kind: "video",
    ...extra,
});

const setup = (item: CatalogItem) => {
    const store = createStore();
    store.set(videosAtom as unknown as PrimitiveAtom<CatalogItem[]>, [item]);
    return store;
};

describe("premiere atoms", () => {
    beforeEach(() => {
        jest.useFakeTimers({now: NOW});
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    it("is null when no episode is pending", () => {
        const store = setup(video({}));
        const unsub = store.sub(premiereViewAtom, () => {});
        expect(store.get(premiereViewAtom)).toBeNull();
        expect(store.get(premiereLockedIdAtom)).toBeNull();
        unsub();
    });

    it("counts down from the wall clock", () => {
        const store = setup(
            video({
                premiere_at: new Date(NOW + 112 * MIN + 30 * SEC).toISOString(),
            })
        );
        const unsub = store.sub(premiereViewAtom, () => {});
        expect(store.get(premiereViewAtom)).toMatchObject({
            phase: "scheduled",
            label: "1h 52m",
        });

        jest.advanceTimersByTime(31 * SEC);
        expect(store.get(premiereViewAtom)?.label).toBe("1h 51m");
        unsub();
    });

    it("keeps the same snapshot between ticks of the same minute", () => {
        const store = setup(
            video({
                premiere_at: new Date(NOW + 112 * MIN + 30 * SEC).toISOString(),
            })
        );
        const notify = jest.fn();
        const unsub = store.sub(premiereViewAtom, notify);
        const first = store.get(premiereViewAtom);

        jest.advanceTimersByTime(25 * SEC);
        expect(store.get(premiereViewAtom)).toBe(first);
        expect(notify).not.toHaveBeenCalled();
        unsub();
    });

    it("shows seconds and turns imminent in the last ten minutes", () => {
        const store = setup(
            video({
                premiere_at: new Date(NOW + 10 * MIN + 2 * SEC).toISOString(),
            })
        );
        const unsub = store.sub(premiereViewAtom, () => {});
        expect(store.get(premiereViewAtom)?.phase).toBe("scheduled");

        jest.advanceTimersByTime(3 * SEC);
        expect(store.get(premiereViewAtom)).toMatchObject({
            phase: "imminent",
            label: "9m 59s",
        });
        unsub();
    });

    it("goes live at the scheduled instant and unlocks the episode", () => {
        const store = setup(
            video({
                live_status: "upcoming",
                premiere_at: new Date(NOW + 5 * SEC).toISOString(),
            })
        );
        const unsub = store.sub(premiereViewAtom, () => {});
        expect(store.get(premiereLockedIdAtom)).toBe("premiere");

        jest.advanceTimersByTime(5 * SEC);
        expect(store.get(premiereViewAtom)).toMatchObject({
            phase: "live",
            label: "¡Ya salió!",
        });
        expect(store.get(premiereLockedIdAtom)).toBeNull();
        unsub();
    });

    it("only notifies the lock when the lock changes, not on ticks", () => {
        const store = setup(
            video({premiere_at: new Date(NOW + 60 * MIN).toISOString()})
        );
        const notify = jest.fn();
        const unsub = store.sub(premiereLockedIdAtom, notify);
        jest.advanceTimersByTime(30 * SEC);
        expect(notify).not.toHaveBeenCalled();
        unsub();
    });
});
