/**
 * Rebuilds `assets/data/data.json` from the YouTube channel.
 *
 * Two passes, both through yt-dlp, both without an API key:
 *
 *  1. Listing pass — `--flat-playlist` over /videos and /shorts. Cheap (two
 *     requests), but YouTube's playlist payload has no like count, so this pass
 *     only produces what it always produced.
 *  2. Stats pass — a full extraction per video id, which does carry
 *     `like_count` and `upload_date`. That costs one request per video, so it
 *     is incremental by default: only ids that have no stats yet, most watched
 *     first, capped per run. Stats already in the file are carried over, so a
 *     weekly job backfills the catalog instead of re-scraping 3.6k videos.
 *
 * Every field the app already reads is written exactly as before. The new ones
 * (`title_clean`, `season`, `season_number`, `season_short`, `series`,
 * `episode_number`, `hashtags`, `like_count`, `like_ratio`, `upload_date`,
 * `stats_checked_at`) are additive.
 *
 * Usage:
 *   node scripts/update-videos-list.js                 # full refresh + incremental likes
 *   node scripts/update-videos-list.js --offline       # re-derive fields, no network
 *   node scripts/update-videos-list.js --skip-listing  # keep the list, fetch likes only
 *   node scripts/update-videos-list.js --dry-run       # print a sample, write nothing
 *   node scripts/update-videos-list.js --likes=all --likes-limit=1000
 *   node scripts/update-videos-list.js --likes=none    # listing only
 */

const fs = require("node:fs");
const path = require("node:path");
const {spawn} = require("node:child_process");
const {DEFAULT_SERIES, likeRatio, parseTitle} = require("./lib/titles");

const dataPath = path.join(__dirname, "..", "assets/data", "data.json");
const channelUrls = {
    videos: "https://www.youtube.com/@HablandoHuevadasOficial/videos",
    shorts: "https://www.youtube.com/@HablandoHuevadasOficial/shorts",
};

const DEFAULTS = {
    /** none | missing | all */
    likes: "missing",
    /** Videos enriched with likes per run. Keeps the weekly job under ~5 min. */
    likesLimit: 400,
    /** Parallel yt-dlp processes. Six is comfortable; twelve gets throttled. */
    concurrency: 6,
    /** Ids per yt-dlp process — one spawn for many videos amortises startup. */
    batchSize: 10,
    /** With --likes=all, stats newer than this are left alone. */
    likesMaxAgeDays: 30,
    skipListing: false,
    dryRun: false,
    sample: 6,
};

const parseArgs = (argv) => {
    const options = {...DEFAULTS};
    for (const arg of argv) {
        const [flag, value] = arg.split("=");
        switch (flag) {
            case "--offline":
                // Nothing touches the network: re-derive from what is on disk.
                options.skipListing = true;
                options.likes = "none";
                break;
            case "--skip-listing":
                options.skipListing = true;
                break;
            case "--dry-run":
                options.dryRun = true;
                break;
            case "--likes":
                options.likes = value ?? "missing";
                break;
            case "--likes-limit":
                options.likesLimit = Number(value);
                break;
            case "--likes-max-age":
                options.likesMaxAgeDays = Number(value);
                break;
            case "--concurrency":
                options.concurrency = Number(value);
                break;
            case "--batch-size":
                options.batchSize = Number(value);
                break;
            case "--sample":
                options.sample = Number(value);
                break;
            default:
                if (flag.startsWith("--")) {
                    console.warn(`Unknown option ignored: ${flag}`);
                }
        }
    }
    return options;
};

const readExisting = () => {
    try {
        return JSON.parse(fs.readFileSync(dataPath, "utf8"));
    } catch {
        return null;
    }
};

/** yt-dlp -> the exact shape the app has always consumed. Do not reorder. */
const toBaseEntry = (video) => ({
    id: video.id,
    link: video.webpage_url,
    title: video.title,
    description: video.description,
    duration: video.duration,
    duration_string: video.duration_string,
    view_count: video.view_count,
    thumbnail:
        video.thumbnails && video.thumbnails.length > 0
            ? video.thumbnails[video.thumbnails.length - 1].url
            : null,
    thumbnails: video.thumbnails,
    channel: video.channel,
    channel_id: video.channel_id,
    uploader: video.uploader,
    uploader_id: video.uploader_id,
});

/** Fields this script owns. Rewritten on every run, never merged. */
const DERIVED_FIELDS = [
    "title_clean",
    "season",
    "season_number",
    "season_short",
    "series",
    "episode_number",
    "hashtags",
];

/**
 * Adds the derived fields on top of an entry, carrying any stats already known
 * for that id so the incremental pass never loses work.
 */
const enrich = (entry, previous) => {
    const derived = parseTitle(entry.title);
    const likeCount = previous?.like_count ?? entry.like_count ?? null;

    // Start from the raw entry with the previous run's derived fields removed:
    // a re-derive has to be able to drop a field, not just overwrite it.
    const next = {...entry};
    for (const field of DERIVED_FIELDS) delete next[field];

    // Empty derived values are dropped rather than written as null: the file is
    // bundled into the app and parsed on every cold start, so 3.6k rows of
    // `"season": null` is a cost with no reader.
    const put = (field, value) => {
        if (value === null || value === undefined) return;
        if (Array.isArray(value) && value.length === 0) return;
        next[field] = value;
    };

    put("title_clean", derived.title_clean);
    put("season", derived.season);
    put("season_number", derived.season_number);
    put("season_short", derived.season_short);
    // Only the spin-offs get a `series`: writing "Hablando Huevadas" on 3.6k
    // rows would be 100KB of the same string.
    if (derived.series !== DEFAULT_SERIES) put("series", derived.series);
    put("episode_number", derived.episode_number);
    put("hashtags", derived.hashtags);
    put("like_count", likeCount);
    put(
        "like_ratio",
        previous?.like_ratio ??
            entry.like_ratio ??
            likeRatio(likeCount, entry.view_count)
    );
    put("upload_date", previous?.upload_date ?? entry.upload_date);
    put(
        "stats_checked_at",
        previous?.stats_checked_at ?? entry.stats_checked_at
    );

    return next;
};

const runYtDlp = (args) =>
    new Promise((resolve) => {
        const child = spawn("yt-dlp", args);
        let out = "";
        let err = "";
        child.stdout.on("data", (chunk) => {
            out += chunk.toString();
        });
        child.stderr.on("data", (chunk) => {
            err += chunk.toString();
        });
        child.on("error", (error) => {
            resolve({code: -1, out: "", err: String(error)});
        });
        child.on("close", (code) => resolve({code, out, err}));
    });

const parseJsonLines = (payload) => {
    const rows = [];
    for (const line of payload.split("\n")) {
        if (!line.trim()) continue;
        try {
            rows.push(JSON.parse(line));
        } catch {
            /* yt-dlp interleaves the odd non-JSON line on partial failures */
        }
    }
    return rows;
};

const fetchListing = async (url) => {
    console.log(`Fetching videos from ${url}...`);
    const {code, out, err} = await runYtDlp([
        "-j",
        "--flat-playlist",
        "--ignore-errors",
        "--no-warnings",
        url,
    ]);
    if (code !== 0 && !out) {
        console.error(`yt-dlp failed for ${url} (code ${code})`);
        if (err) console.error(err.split("\n").slice(-3).join("\n"));
        return [];
    }
    return parseJsonLines(out).map(toBaseEntry);
};

/* --------------------------------- stats pass ----------------------------- */

const DAY_MS = 86_400_000;

const isStale = (entry, maxAgeDays) => {
    if (!entry.stats_checked_at) return true;
    const checked = Date.parse(entry.stats_checked_at);
    if (Number.isNaN(checked)) return true;
    return Date.now() - checked > maxAgeDays * DAY_MS;
};

/**
 * Which ids get a full extraction this run.
 *
 * Ordered by view count: likes are a ranking signal, and a signal is worth most
 * where the audience already is. Videos before shorts for the same reason —
 * the home feed is built from videos.
 */
const selectForStats = (data, options) => {
    if (options.likes === "none") return [];

    const wanted = [];
    for (const kind of ["videos", "shorts"]) {
        for (const entry of data[kind] ?? []) {
            const needs =
                options.likes === "all"
                    ? isStale(entry, options.likesMaxAgeDays)
                    : entry.like_count === null ||
                      entry.like_count === undefined;
            if (needs) wanted.push({kind, entry});
        }
    }

    wanted.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "videos" ? -1 : 1;
        return (b.entry.view_count ?? 0) - (a.entry.view_count ?? 0);
    });

    return wanted.slice(0, Math.max(0, options.likesLimit));
};

const chunk = (items, size) => {
    const out = [];
    for (let i = 0; i < items.length; i += size)
        out.push(items.slice(i, i + size));
    return out;
};

const fetchStatsBatch = async (ids) => {
    const {out} = await runYtDlp([
        "-j",
        "--skip-download",
        "--no-warnings",
        "--ignore-errors",
        "--socket-timeout",
        "20",
        "--retries",
        "2",
        ...ids.map((id) => `https://www.youtube.com/watch?v=${id}`),
    ]);

    const stats = new Map();
    for (const video of parseJsonLines(out)) {
        if (!video.id) continue;
        stats.set(video.id, {
            like_count:
                typeof video.like_count === "number" ? video.like_count : null,
            view_count:
                typeof video.view_count === "number" ? video.view_count : null,
            upload_date: video.upload_date
                ? `${video.upload_date.slice(0, 4)}-${video.upload_date.slice(4, 6)}-${video.upload_date.slice(6, 8)}`
                : null,
        });
    }
    return stats;
};

/** Runs `worker` over `jobs` with a fixed pool size. */
const pooled = async (jobs, size, worker) => {
    let cursor = 0;
    const runners = Array.from(
        {length: Math.min(size, jobs.length)},
        async () => {
            while (cursor < jobs.length) {
                const index = cursor++;
                await worker(jobs[index], index);
            }
        }
    );
    await Promise.all(runners);
};

const fetchStats = async (targets, options) => {
    if (targets.length === 0) return {hits: 0, misses: 0};

    const batches = chunk(
        targets.map((target) => target.entry.id),
        options.batchSize
    );
    const byId = new Map(
        targets.map((target) => [target.entry.id, target.entry])
    );
    const startedAt = Date.now();
    let done = 0;
    let hits = 0;

    console.log(
        `Fetching likes for ${targets.length} videos in ${batches.length} batches (concurrency ${options.concurrency})...`
    );

    await pooled(batches, options.concurrency, async (ids) => {
        const stats = await fetchStatsBatch(ids);
        const checkedAt = new Date().toISOString();

        for (const id of ids) {
            const entry = byId.get(id);
            const row = stats.get(id);
            if (!entry) continue;
            if (!row || row.like_count === null) {
                // Likes hidden by the uploader, or the video is gone. Stamp the
                // check anyway so the next run does not retry it forever.
                entry.stats_checked_at = checkedAt;
                continue;
            }
            entry.like_count = row.like_count;
            entry.like_ratio = likeRatio(
                row.like_count,
                row.view_count ?? entry.view_count
            );
            entry.upload_date = row.upload_date ?? entry.upload_date ?? null;
            entry.stats_checked_at = checkedAt;
            hits += 1;
        }

        done += ids.length;
        const elapsed = (Date.now() - startedAt) / 1000;
        const rate = done / Math.max(elapsed, 0.001);
        const eta = Math.round((targets.length - done) / Math.max(rate, 0.001));
        process.stdout.write(
            `  likes ${done}/${targets.length} · ${rate.toFixed(1)}/s · ETA ${eta}s\r`
        );
    });

    process.stdout.write("\n");
    return {hits, misses: targets.length - hits};
};

/* ----------------------------------- report -------------------------------- */

const report = (data, options) => {
    const videos = data.videos ?? [];
    const shorts = data.shorts ?? [];
    const all = [...videos, ...shorts];
    const withSeason = videos.filter((v) => v.season).length;
    const withNumber = videos.filter((v) => v.season_number).length;
    const withLikes = all.filter(
        (v) => typeof v.like_count === "number"
    ).length;

    console.log("\n─── derived fields ─────────────────────────────────────");
    console.log(`videos               ${videos.length}`);
    console.log(`shorts               ${shorts.length}`);
    console.log(
        `season detected      ${withSeason}/${videos.length} (${Math.round((withSeason / Math.max(videos.length, 1)) * 100)}%)`
    );
    console.log(
        `season numbered      ${withNumber}/${videos.length} (${Math.round((withNumber / Math.max(videos.length, 1)) * 100)}%)`
    );
    console.log(`likes on file        ${withLikes}/${all.length}`);

    const seasons = new Map();
    for (const video of videos) {
        const label = video.season ?? "(sin temporada)";
        seasons.set(label, (seasons.get(label) ?? 0) + 1);
    }
    console.log("\nseasons:");
    for (const [label, count] of [...seasons.entries()].sort(
        (a, b) => b[1] - a[1]
    )) {
        console.log(`  ${String(count).padStart(4)}  ${label}`);
    }

    console.log("\nsample:");
    for (const video of videos.slice(0, Math.max(0, options.sample))) {
        console.log(`  raw    ${video.title}`);
        console.log(
            `  clean  ${video.title_clean}  ·  ${video.season ?? "—"}  ·  ${video.season_short ?? "—"}  ·  likes ${video.like_count ?? "—"}`
        );
    }
    console.log("────────────────────────────────────────────────────────\n");
};

/* ------------------------------------ main --------------------------------- */

const main = async () => {
    const options = parseArgs(process.argv.slice(2));
    const existing = readExisting();
    const previousById = new Map();
    for (const kind of ["videos", "shorts"]) {
        for (const entry of existing?.[kind] ?? []) {
            previousById.set(entry.id, entry);
        }
    }

    const data = {channel: existing?.channel ?? "Hablando Huevadas"};

    if (options.skipListing) {
        if (!existing) {
            console.error(
                "--offline/--skip-listing need an existing data.json to work from."
            );
            process.exitCode = 1;
            return;
        }
        console.log(
            "Skipping the listing fetch: re-deriving from the current data.json."
        );
        for (const kind of ["videos", "shorts"]) {
            data[kind] = (existing[kind] ?? []).map((entry) =>
                enrich(entry, entry)
            );
        }
    } else {
        console.log("Fetching all videos from Hablando Huevadas...");
        for (const [kind, url] of Object.entries(channelUrls)) {
            const listed = await fetchListing(url);
            if (listed.length === 0 && existing?.[kind]?.length) {
                console.warn(
                    `Keeping the previous ${kind} list: the fetch returned nothing.`
                );
                data[kind] = existing[kind].map((entry) =>
                    enrich(entry, entry)
                );
                continue;
            }
            data[kind] = listed.map((entry) =>
                enrich(entry, previousById.get(entry.id))
            );
        }
    }

    if (options.likes !== "none") {
        const targets = selectForStats(data, options);
        if (targets.length > 0) {
            const {hits, misses} = await fetchStats(targets, options);
            console.log(
                `Likes updated for ${hits} videos (${misses} without a public count).`
            );
        } else {
            console.log(
                "Every video already has likes on file. Nothing to fetch."
            );
        }
    }

    report(data, options);

    if (options.dryRun) {
        console.log("Dry run: data.json was not written.");
        return;
    }

    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    console.log(
        `Successfully updated data.json with ${data.videos.length} videos and ${data.shorts.length} shorts.`
    );
};

main().catch((error) => {
    console.error("Failed to update video list:", error);
    process.exitCode = 1;
});
