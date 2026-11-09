import type {SeedSource} from "@/catalog/application/ports";
import type {RawDataset} from "@/catalog/domain/dataset";

/**
 * The dataset baked into the bundle, refreshed from the published file on
 * every OTA update and store build. Required lazily: the parse is large.
 */
export const bundledSeed: SeedSource = () =>
    require("@assets/data/data.json") as RawDataset;
