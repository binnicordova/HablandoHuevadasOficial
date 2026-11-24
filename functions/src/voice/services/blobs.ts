import type {Readable} from "node:stream";
import type {Bucket} from "@google-cloud/storage";

/** The few Storage operations this service needs, so tests need no bucket. */
export interface BlobStore {
    /** Object paths under `prefix`, e.g. `voices/jorge-sample/sample.wav`. */
    list(prefix: string): Promise<string[]>;
    read(path: string): Promise<Buffer | null>;
    /** A read stream, or null when the object does not exist. */
    stream(path: string): Promise<{stream: Readable; size: number} | null>;
}

export class StorageBlobStore implements BlobStore {
    constructor(private readonly bucket: Bucket) {}

    async list(prefix: string): Promise<string[]> {
        const [files] = await this.bucket.getFiles({prefix});
        return files.map((file) => file.name);
    }

    async read(path: string): Promise<Buffer | null> {
        const file = this.bucket.file(path);
        const [exists] = await file.exists();
        if (!exists) return null;
        const [contents] = await file.download();
        return contents;
    }

    async stream(path: string) {
        const file = this.bucket.file(path);
        const [exists] = await file.exists();
        if (!exists) return null;
        const [metadata] = await file.getMetadata();
        return {
            stream: file.createReadStream(),
            size: Number(metadata.size ?? 0),
        };
    }
}
