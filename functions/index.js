const {initializeApp} = require("firebase-admin/app");
const {getStorage} = require("firebase-admin/storage");
const {logger} = require("firebase-functions");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {publishCatalog} = require("./publish");

initializeApp();

/*
 * New episodes go up Sunday 21:00 Lima, but the premiere page is listed on the
 * channel days earlier. One function runs four times a day: 08:00, 14:00 and
 * 20:00 announce a premiere ahead of time (20:00 is the last run before it),
 * and 23:00 captures the published episode, with 08:00 the next morning as the
 * catch-up for a late publish. Every run is idempotent: an unchanged catalog
 * is not uploaded.
 */
const options = {
    timeZone: "America/Lima",
    region: "us-east1",
    timeoutSeconds: 1800,
    memory: "2GiB",
    // The next scheduled run is the retry; an immediate one would only hit the same limit.
    retryCount: 0,
};

const publish = async () => {
    const outcome = await publishCatalog(getStorage().bucket());
    logger.info(`Catalog ${outcome}`);
};

exports.publishCatalog = onSchedule(
    {...options, schedule: "0 8,14,20,23 * * *"},
    publish
);
