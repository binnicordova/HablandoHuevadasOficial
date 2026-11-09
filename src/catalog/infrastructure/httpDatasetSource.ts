import type {DatasetSource} from "@/catalog/application/ports";

/** Plain conditional GET of a static file: no API, so a 304 costs nothing. */
export const httpDatasetSource = (url: string): DatasetSource => ({
    async fetch(etag) {
        const response = await fetch(url, {
            headers: {
                Accept: "application/json",
                ...(etag ? {"If-None-Match": etag} : {}),
            },
        });
        if (response.status === 304) return {status: "not-modified"};
        if (!response.ok)
            throw new Error(`Dataset request: ${response.status}`);
        return {
            status: "ok",
            body: await response.text(),
            etag: response.headers.get("etag"),
        };
    },
});
