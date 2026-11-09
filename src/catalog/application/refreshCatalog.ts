import {
    isPlausibleReplacement,
    parseDataset,
    type RawDataset,
} from "@/catalog/domain/dataset";
import {isRefreshDue} from "@/catalog/domain/syncPolicy";
import type {CatalogStore, DatasetSource, SyncStateStore} from "./ports";

export type RefreshOutcome =
    | {status: "skipped" | "not-modified" | "rejected" | "failed"}
    | {status: "updated"; dataset: RawDataset};

type Deps = {
    source: DatasetSource;
    store: CatalogStore;
    state: SyncStateStore;
    /** The dataset currently on screen, to refuse a suspicious shrink. */
    current: () => RawDataset;
    now?: () => number;
};

/**
 * Conditional GET, verify, then swap. Stored data is replaced only after the
 * whole body parsed and validated; every other path leaves it untouched, and
 * the ETag is saved only after the swap so a 304 can never mask a missing file.
 */
export const refreshCatalog = async ({
    source,
    store,
    state,
    current,
    now = Date.now,
}: Deps): Promise<RefreshOutcome> => {
    try {
        const saved = await state.read();
        if (!isRefreshDue(now(), saved.lastCheckedAt)) {
            return {status: "skipped"};
        }

        // Without a file on disk the saved ETag proves nothing.
        const hasFile = await store.exists();
        const result = await source.fetch(hasFile ? saved.etag : null);

        if (result.status === "not-modified") {
            await state.write({...saved, lastCheckedAt: now()});
            return {status: "not-modified"};
        }

        const dataset = parseDataset(result.body);
        if (!isPlausibleReplacement(current(), dataset)) {
            return {status: "rejected"};
        }

        await store.write(result.body);
        await state.write({etag: result.etag, lastCheckedAt: now()});
        return {status: "updated", dataset};
    } catch {
        return {status: "failed"};
    }
};
