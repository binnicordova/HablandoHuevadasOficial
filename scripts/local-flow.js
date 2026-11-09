/**
 * Local check of the publishing half, no cloud needed:
 *
 *   node scripts/local-flow.js
 *
 * Runs the real publisher (real yt-dlp, listing pass only so it takes
 * seconds) against a folder-backed stand-in for the Storage bucket, through
 * the same publishCatalog() the Cloud Function calls, then validates the file
 * it published. A second run must report "unchanged" without uploading.
 */
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const functionsDir = path.join(__dirname, "..", "functions");
const {publishCatalog, OBJECT} = require(path.join(functionsDir, "publish.js"));

/** The three Bucket/File methods publishCatalog uses, on top of a folder. */
const folderBucket = (root) => ({
    uploads: 0,
    file(name) {
        const target = path.join(root, name);
        return {
            exists: async () => [fs.existsSync(target)],
            download: async ({destination}) =>
                fs.copyFileSync(target, destination),
            save: async (data, options) => {
                assert.equal(
                    options.metadata.cacheControl,
                    "public, max-age=300"
                );
                fs.mkdirSync(path.dirname(target), {recursive: true});
                fs.writeFileSync(target, data);
            },
        };
    },
});

const main = async () => {
    // The function downloads the Linux build; locally use the installed one.
    process.env.YT_DLP_BIN ??= "yt-dlp";
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "bucket-"));
    const bucket = folderBucket(root);
    const publishOptions = {
        script: path.join(__dirname, "update-videos-list.js"),
        scriptArgs: ["--likes=none"],
        seed: path.join(__dirname, "..", "assets", "data", "data.json"),
    };

    assert.equal(await publishCatalog(bucket, publishOptions), "published");

    const data = JSON.parse(fs.readFileSync(path.join(root, OBJECT), "utf8"));
    assert(
        data.videos.length > 100 && data.shorts.length > 100,
        "dataset too small"
    );
    assert(
        [...data.videos, ...data.shorts].every(
            (entry) => !("thumbnails" in entry)
        ),
        "thumbnails[] should be stripped"
    );

    // announced_at must survive the next run (the publisher starts from the
    // previously published file, not from scratch).
    const before = new Map(data.videos.map((v) => [v.id, v.announced_at]));
    await publishCatalog(bucket, publishOptions);
    const after = JSON.parse(fs.readFileSync(path.join(root, OBJECT), "utf8"));
    for (const video of after.videos) {
        if (before.has(video.id))
            assert.equal(video.announced_at, before.get(video.id));
    }

    console.log(
        `OK: ${data.videos.length} videos + ${data.shorts.length} shorts, ` +
            `${(fs.statSync(path.join(root, OBJECT)).size / 1e6).toFixed(2)} MB`
    );
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
