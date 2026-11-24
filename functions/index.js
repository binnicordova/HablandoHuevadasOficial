const {initializeApp} = require("firebase-admin/app");
const {getStorage} = require("firebase-admin/storage");
const {logger} = require("firebase-functions");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {publishCatalog} = require("./publish");

initializeApp();

/*
 * New episodes premiere Sunday 21:00 Lima. A single weekly run at 16:00, five
 * hours earlier, lists the scheduled premiere so the app can announce it
 * ahead of time. The run is idempotent: an unchanged catalog is not uploaded.
 */
const options = {
    timeZone: "America/Lima",
    region: "us-east1",
    timeoutSeconds: 1800,
    memory: "2GiB",
    // An immediate retry would only hit the same limit.
    retryCount: 0,
};

const publish = async () => {
    const outcome = await publishCatalog(getStorage().bucket());
    logger.info(`Catalog ${outcome}`);
};

exports.publishCatalog = onSchedule(
    {...options, schedule: "0 16 * * 0"},
    publish
);
