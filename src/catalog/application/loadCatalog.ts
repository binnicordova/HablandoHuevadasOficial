import {parseDataset, type RawDataset} from "@/catalog/domain/dataset";
import type {CatalogStore} from "./ports";

/**
 * The downloaded dataset when there is a usable one; null means "stay on the
 * bundled seed". A corrupt or unreadable file is never fatal.
 */
export const loadDownloadedDataset = async (
    store: CatalogStore
): Promise<RawDataset | null> => {
    try {
        const text = await store.read();
        return text ? parseDataset(text) : null;
    } catch {
        return null;
    }
};
