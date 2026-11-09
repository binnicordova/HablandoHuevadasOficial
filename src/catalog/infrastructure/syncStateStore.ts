import type {SyncState, SyncStateStore} from "@/catalog/application/ports";
import {STORAGE_ID} from "@/constants/storage";
import {storage} from "@/utils/storage";

const EMPTY: SyncState = {etag: null, lastCheckedAt: null};

export const syncStateStore: SyncStateStore = {
    async read() {
        return (
            (await storage.getItem<SyncState>(STORAGE_ID.catalogSync)) ?? EMPTY
        );
    },
    write: (state) => storage.setItem(STORAGE_ID.catalogSync, state),
};
