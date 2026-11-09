import {loadDownloadedDataset} from "@/catalog/application/loadCatalog";
import type {
    CatalogStore,
    DatasetSource,
    FetchResult,
    SyncState,
    SyncStateStore,
} from "@/catalog/application/ports";
import {refreshCatalog} from "@/catalog/application/refreshCatalog";
import {
    isPlausibleReplacement,
    parseDataset,
    type RawDataset,
} from "@/catalog/domain/dataset";
import {isRefreshDue, SYNC_INTERVAL_MS} from "@/catalog/domain/syncPolicy";

const item = (id: string) =>
    ({id, title: `t ${id}`}) as RawDataset["videos"][0];
const dataset = (videos: string[], shorts: string[] = []): RawDataset => ({
    channel: "c",
    videos: videos.map(item),
    shorts: shorts.map(item),
});

const memoryStore = (initial: string | null = null) => {
    const store: CatalogStore & {body: string | null; writes: number} = {
        body: initial,
        writes: 0,
        exists: async () => store.body !== null,
        read: async () => store.body,
        write: async (body) => {
            store.body = body;
            store.writes += 1;
        },
    };
    return store;
};

const memoryState = (
    initial: SyncState = {etag: null, lastCheckedAt: null}
) => {
    const state: SyncStateStore & {value: SyncState} = {
        value: initial,
        read: async () => state.value,
        write: async (next) => {
            state.value = next;
        },
    };
    return state;
};

const source = (result: FetchResult | Error) => {
    const calls: (string | null)[] = [];
    const impl: DatasetSource = {
        fetch: async (etag) => {
            calls.push(etag);
            if (result instanceof Error) throw result;
            return result;
        },
    };
    return {impl, calls};
};

const NOW = 1_000_000_000_000;

describe("syncPolicy", () => {
    it("is due when never checked or after the interval", () => {
        expect(isRefreshDue(NOW, null)).toBe(true);
        expect(isRefreshDue(NOW, NOW - SYNC_INTERVAL_MS)).toBe(true);
        expect(isRefreshDue(NOW, NOW - SYNC_INTERVAL_MS + 1)).toBe(false);
    });
});

describe("parseDataset", () => {
    it("accepts a valid dataset", () => {
        expect(
            parseDataset(JSON.stringify(dataset(["a"], ["b"]))).videos
        ).toHaveLength(1);
    });

    it.each([
        ["truncated json", '{"channel":"c","videos":['],
        ["wrong shape", '{"videos":[]}'],
        ["empty", JSON.stringify(dataset([]))],
        [
            "item without id",
            JSON.stringify({channel: "c", videos: [{title: "x"}], shorts: []}),
        ],
    ])("rejects %s", (_name, text) => {
        expect(() => parseDataset(text)).toThrow();
    });

    it("refuses a release that shrinks below half", () => {
        const current = dataset(["a", "b", "c", "d"]);
        expect(isPlausibleReplacement(current, dataset(["a", "b"]))).toBe(true);
        expect(isPlausibleReplacement(current, dataset(["a"]))).toBe(false);
    });
});

describe("loadDownloadedDataset", () => {
    it("returns null when nothing was downloaded or the file is corrupt", async () => {
        expect(await loadDownloadedDataset(memoryStore())).toBeNull();
        expect(await loadDownloadedDataset(memoryStore("{nope"))).toBeNull();
    });

    it("returns the stored dataset", async () => {
        const stored = memoryStore(JSON.stringify(dataset(["a"])));
        expect((await loadDownloadedDataset(stored))?.videos[0].id).toBe("a");
    });
});

describe("refreshCatalog", () => {
    const current = () => dataset(["a", "b"]);
    const deps = (
        s: DatasetSource,
        store = memoryStore(),
        state = memoryState()
    ) => ({
        source: s,
        store,
        state,
        current,
        now: () => NOW,
    });

    it("skips the network when checked recently", async () => {
        const {impl, calls} = source({status: "not-modified"});
        const state = memoryState({etag: "e", lastCheckedAt: NOW - 1000});
        expect(
            (await refreshCatalog(deps(impl, memoryStore("{}"), state))).status
        ).toBe("skipped");
        expect(calls).toHaveLength(0);
    });

    it("bypasses the throttle when forced", async () => {
        const {impl, calls} = source({status: "not-modified"});
        const state = memoryState({etag: "e", lastCheckedAt: NOW - 1000});
        const outcome = await refreshCatalog({
            ...deps(impl, memoryStore("{}"), state),
            force: true,
        });
        expect(outcome.status).toBe("not-modified");
        expect(calls).toHaveLength(1);
    });

    it("stores a valid download and remembers its etag", async () => {
        const body = JSON.stringify(dataset(["a", "b", "c"]));
        const {impl} = source({status: "ok", body, etag: '"v2"'});
        const store = memoryStore();
        const state = memoryState();
        const outcome = await refreshCatalog(deps(impl, store, state));
        expect(outcome.status).toBe("updated");
        expect(store.body).toBe(body);
        expect(state.value).toEqual({etag: '"v2"', lastCheckedAt: NOW});
    });

    it("sends the etag only when a file is on disk", async () => {
        const saved = {etag: '"v1"', lastCheckedAt: null};
        const withFile = source({status: "not-modified"});
        await refreshCatalog(
            deps(withFile.impl, memoryStore("{}"), memoryState(saved))
        );
        expect(withFile.calls).toEqual(['"v1"']);

        const noFile = source({status: "not-modified"});
        await refreshCatalog(
            deps(noFile.impl, memoryStore(), memoryState(saved))
        );
        expect(noFile.calls).toEqual([null]);
    });

    it("keeps old data on 304 and only moves the check time", async () => {
        const {impl} = source({status: "not-modified"});
        const store = memoryStore("old");
        const state = memoryState({etag: '"v1"', lastCheckedAt: null});
        expect((await refreshCatalog(deps(impl, store, state))).status).toBe(
            "not-modified"
        );
        expect(store.writes).toBe(0);
        expect(state.value).toEqual({etag: '"v1"', lastCheckedAt: NOW});
    });

    it("keeps old data when the body is truncated or invalid", async () => {
        const {impl} = source({
            status: "ok",
            body: '{"channel":"c","vid',
            etag: '"x"',
        });
        const store = memoryStore("old");
        const state = memoryState({etag: '"v1"', lastCheckedAt: null});
        expect((await refreshCatalog(deps(impl, store, state))).status).toBe(
            "failed"
        );
        expect(store.body).toBe("old");
        expect(state.value.etag).toBe('"v1"');
    });

    it("rejects a release that lost most of the catalog", async () => {
        const {impl} = source({
            status: "ok",
            body: JSON.stringify(dataset(["a"])),
            etag: null,
        });
        const store = memoryStore("old");
        const outcome = await refreshCatalog({
            ...deps(impl, store),
            current: () => dataset(["a", "b", "c", "d"]),
        });
        expect(outcome.status).toBe("rejected");
        expect(store.body).toBe("old");
    });

    it("keeps old data and retries later when offline", async () => {
        const {impl} = source(new Error("offline"));
        const store = memoryStore("old");
        const state = memoryState();
        expect((await refreshCatalog(deps(impl, store, state))).status).toBe(
            "failed"
        );
        expect(store.body).toBe("old");
        expect(state.value.lastCheckedAt).toBeNull();
    });
});
