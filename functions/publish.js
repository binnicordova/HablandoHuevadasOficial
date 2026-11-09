const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {spawn} = require("node:child_process");

const OBJECT = "public/data.json";
/** Bundled by scripts/vendor-publisher.js: the release to start from before
 *  anything was ever published. Starting empty would stamp every video with
 *  a fresh announced_at and flag the whole catalog as a premiere. */
const SEED = path.join(__dirname, "vendor", "seed.json");
const YT_DLP_URL =
    "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";

const run = (command, args, env) =>
    new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            env: {...process.env, ...env},
            stdio: "inherit",
        });
        child.on("error", reject);
        child.on("close", (code) =>
            code === 0
                ? resolve()
                : reject(new Error(`${command} exited ${code}`))
        );
    });

/** Standalone yt-dlp build: Cloud Run images have no Python to run the zipapp. */
const ensureYtDlp = async (dir) => {
    if (process.env.YT_DLP_BIN) return process.env.YT_DLP_BIN;
    const bin = path.join(dir, "yt-dlp");
    const response = await fetch(YT_DLP_URL);
    if (!response.ok) throw new Error(`yt-dlp download: ${response.status}`);
    fs.writeFileSync(bin, Buffer.from(await response.arrayBuffer()), {
        mode: 0o755,
    });
    return bin;
};

/**
 * Rebuilds the catalog and publishes it as the public static file the app
 * downloads. Starts from the previously published file so announced_at and
 * the like stats carry over, and uploads only when the content changed.
 *
 * @param {import("@google-cloud/storage").Bucket} bucket
 * @param {{scriptArgs?: string[], script?: string, seed?: string}} [options]
 * @returns {Promise<"published" | "unchanged">}
 */
const publishCatalog = async (bucket, options = {}) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-"));
    const dataPath = path.join(dir, "data.json");
    const script =
        options.script ??
        path.join(__dirname, "vendor", "update-videos-list.js");
    const scriptArgs = options.scriptArgs ?? [
        "--likes=missing",
        "--likes-limit=500",
        "--concurrency=3",
    ];

    const file = bucket.file(OBJECT);
    const [exists] = await file.exists();
    if (exists) await file.download({destination: dataPath});
    else fs.copyFileSync(options.seed ?? SEED, dataPath);
    const previous = exists ? fs.readFileSync(dataPath) : null;

    const ytDlp = await ensureYtDlp(dir);
    await run(process.execPath, [script, ...scriptArgs], {
        VIDEOS_DATA_PATH: dataPath,
        YT_DLP_BIN: ytDlp,
    });

    const next = fs.readFileSync(dataPath);
    if (previous?.equals(next)) return "unchanged";

    await file.save(next, {
        resumable: false,
        gzip: true,
        metadata: {
            contentType: "application/json",
            cacheControl: "public, max-age=300",
        },
    });
    return "published";
};

module.exports = {publishCatalog, OBJECT};
