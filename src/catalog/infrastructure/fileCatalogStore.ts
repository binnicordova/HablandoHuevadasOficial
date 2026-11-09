import type {CatalogStore} from "@/catalog/application/ports";

const DIRECTORY = "catalog";
const ACTIVE = "data.json";
const STAGING = "data.next.json";

type FileSystemModule = typeof import("expo-file-system");

/**
 * Loaded on demand so a binary without the module degrades to "no downloads,
 * bundled seed only" instead of failing at import time.
 */
const loadFileSystem = (): FileSystemModule => {
    return require("expo-file-system") as FileSystemModule;
};

const files = () => {
    const {Directory, File, Paths} = loadFileSystem();
    const directory = new Directory(Paths.document, DIRECTORY);
    return {
        directory,
        active: new File(directory, ACTIVE),
        staging: new File(directory, STAGING),
    };
};

export const fileCatalogStore: CatalogStore = {
    async exists() {
        try {
            return files().active.exists;
        } catch {
            return false;
        }
    },

    async read() {
        const {active} = files();
        return active.exists ? await active.text() : null;
    },

    async write(body) {
        const {directory, active, staging} = files();
        if (!directory.exists) directory.create({intermediates: true});

        // Write beside the live file, prove it landed intact, then rename over
        // it. A crash before the rename leaves the old dataset in place.
        staging.create({overwrite: true});
        staging.write(body);
        if ((await staging.text()) !== body) {
            staging.delete();
            throw new Error("Staged dataset does not match the download");
        }
        staging.move(active, {overwrite: true});
    },
};
