const {initializeApp} = require("firebase-admin/app");
const {getStorage} = require("firebase-admin/storage");
const {logger} = require("firebase-functions");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {publishCatalog} = require("./publish");

initializeApp();

/*
 * New episodes go up Sunday 21:00 Lima. The first run is two hours later; the
 * catch-up covers a late publish or a premiere that was not listed yet. Both
 * are idempotent: an unchanged catalog is not uploaded.
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

exports.publishCatalog = onSchedule(
    {...options, schedule: "0 23 * * 0"},
    publish
);
exports.publishCatalogCatchup = onSchedule(
    {...options, schedule: "0 7 * * 1"},
    publish
);
