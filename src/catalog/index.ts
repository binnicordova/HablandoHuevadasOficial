import {AppState} from "react-native";
import {loadDownloadedDataset} from "@/catalog/application/loadCatalog";
import {refreshCatalog} from "@/catalog/application/refreshCatalog";
import {fileCatalogStore} from "@/catalog/infrastructure/fileCatalogStore";
import {httpDatasetSource} from "@/catalog/infrastructure/httpDatasetSource";
import {syncStateStore} from "@/catalog/infrastructure/syncStateStore";
import {CATALOG_URL} from "@/constants/env";
import {getActiveDataset, setCatalogDataset} from "@/services/catalog";

/** Composition root of the catalog sync: wires ports to their adapters. */
let running: Promise<void> | null = null;

const sync = async (force: boolean) => {
    const stored = await loadDownloadedDataset(fileCatalogStore);
    if (stored) setCatalogDataset(stored);

    if (!CATALOG_URL) return;
    const outcome = await refreshCatalog({
        source: httpDatasetSource(CATALOG_URL),
        store: fileCatalogStore,
        state: syncStateStore,
        current: getActiveDataset,
        force,
    });
    if (outcome.status === "updated") setCatalogDataset(outcome.dataset);
};

/**
 * Single-flight, and never throws: the seed always keeps the app usable.
 * `force` bypasses the refresh throttle (a conditional GET still answers 304
 * when nothing changed); it is dropped if a sync is already in flight.
 */
export const syncCatalog = ({force = false} = {}): Promise<void> => {
    running ??= sync(force)
        .catch(() => undefined)
        .finally(() => {
            running = null;
        });
    return running;
};

/** Hydrate from disk and refresh now, then again on every return to foreground. */
export const startCatalogSync = () => {
    void syncCatalog();
    AppState.addEventListener("change", (state) => {
        if (state === "active") void syncCatalog();
    });
};
