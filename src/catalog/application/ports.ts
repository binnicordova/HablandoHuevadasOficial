import type {RawDataset} from "@/catalog/domain/dataset";

export type SyncState = {
    etag: string | null;
    lastCheckedAt: number | null;
};

export type FetchResult =
    | {status: "not-modified"}
    | {status: "ok"; body: string; etag: string | null};

export interface DatasetSource {
    fetch(etag: string | null): Promise<FetchResult>;
}

export interface CatalogStore {
    exists(): Promise<boolean>;
    /** The last fully verified download, or null if there is none. */
    read(): Promise<string | null>;
    /** Replaces the active dataset; the previous one survives any failure. */
    write(body: string): Promise<void>;
}

export interface SyncStateStore {
    read(): Promise<SyncState>;
    write(state: SyncState): Promise<void>;
}

/** The dataset that shipped inside the app bundle. */
export type SeedSource = () => RawDataset;
