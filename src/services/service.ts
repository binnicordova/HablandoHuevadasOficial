import type {CatalogItem} from "@/models/video";
import {getShuffledShorts, getVideos} from "@/services/catalog";

/**
 * The catalog ships inside the bundle, so these resolve on the same tick.
 * They stay async only to keep call sites future proof if the dataset ever
 * moves behind the network.
 */
export const fetchVideos = async (): Promise<CatalogItem[]> => getVideos();

export const fetchShorts = async (): Promise<CatalogItem[]> =>
    getShuffledShorts();
