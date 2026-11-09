const {initializeApp} = require("firebase-admin/app");
const {getStorage} = require("firebase-admin/storage");
const {logger} = require("firebase-functions");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {publishCatalog} = require("./publish");

initializeApp();

/*
 * New episodes go up Sunday 21:00 Lima, but the premiere page is listed on the
 * channel days earlier. The announce runs (08:00, 14:00 and 20:00 daily, the
 * last one an hour before the premiere) pick it up so the app can show "Se
 * estrena en..." ahead of time. Sunday 23:00 captures the published episode
 * and the Monday catch-up covers a late publish. All runs are idempotent: an
 * unchanged catalog is not uploaded.
 */
const options = {
    timeZone: "America/Lima",
    region: "us-east1",
    timeoutSeconds: 1800,
    memory: "2GiB",
    // The catch-up run is the retry; an immediate one would only hit the same limit.
    retryCount: 0,
};

const publish = async () => {
    const outcome = await publishCatalog(getStorage().bucket());
    logger.info(`Catalog ${outcome}`);
};

exports.publishCatalogAnnounce = onSchedule(
    {...options, schedule: "0 8,14,20 * * *"},
    publish
);
exports.publishCatalog = onSchedule(
    {...options, schedule: "0 23 * * 0"},
    publish
);
exports.publishCatalogCatchup = onSchedule(
    {...options, schedule: "0 7 * * 1"},
    publish
);
