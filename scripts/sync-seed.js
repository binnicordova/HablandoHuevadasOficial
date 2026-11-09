/**
 * Pulls the published catalog into assets/data/data.json.
 *
 * Used by the OTA and store-build workflows so the bundled offline seed is
 * never older than the last publish (the weekly Cloud Function in functions/
 * is what publishes it).
 *
 * Never fails the pipeline: if the file is unreachable or not a valid dataset
 * the committed copy stays, which is always a usable seed.
 *
 *   CATALOG_URL=https://... node scripts/sync-seed.js
 */
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_URL =
    "https://firebasestorage.googleapis.com/v0/b/hablandohuevadass.firebasestorage.app/o/public%2Fdata.json?alt=media";

const DATA_PATH = path.join(__dirname, "..", "assets", "data", "data.json");

const isDataset = (data) =>
    data &&
    Array.isArray(data.videos) &&
    Array.isArray(data.shorts) &&
    data.videos.length + data.shorts.length > 0;

const main = async () => {
    const url = process.env.CATALOG_URL ?? DEFAULT_URL;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        if (!isDataset(JSON.parse(text))) throw new Error("not a dataset");
        fs.writeFileSync(DATA_PATH, text);
        console.log("Seed refreshed from the published catalog.");
    } catch (error) {
        console.log(`Keeping the committed seed (${error.message}).`);
    }
};

main();
