/**
 * Copies the publisher into functions/vendor so `firebase deploy` ships the
 * exact script the repo tests and runs locally (a function can only deploy
 * files inside its own folder). Run by firebase.json's predeploy hook.
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const target = path.join(root, "functions", "vendor");

fs.rmSync(target, {recursive: true, force: true});
fs.mkdirSync(path.join(target, "lib"), {recursive: true});
fs.copyFileSync(
    path.join(root, "scripts", "update-videos-list.js"),
    path.join(target, "update-videos-list.js")
);
for (const name of fs.readdirSync(path.join(root, "scripts", "lib"))) {
    fs.copyFileSync(
        path.join(root, "scripts", "lib", name),
        path.join(target, "lib", name)
    );
}
fs.copyFileSync(
    path.join(root, "assets", "data", "data.json"),
    path.join(target, "seed.json")
);
console.log("Vendored publisher into functions/vendor");
