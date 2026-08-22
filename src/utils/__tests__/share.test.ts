import type {CatalogItem} from "@/models/video";
import {buildShareMessage, storeUrl} from "@/utils/share";

jest.mock("expo-clipboard", () => ({setStringAsync: jest.fn()}));
jest.mock("expo-linking", () => ({
    createURL: (path: string) => `hablandohuevadasoficial.com://${path}`,
    canOpenURL: jest.fn(),
    openURL: jest.fn(),
}));

const item: CatalogItem = {
    id: "UOGCSLbFIkE",
    kind: "video",
    link: "https://www.youtube.com/watch?v=UOGCSLbFIkE",
    title: "EL KEKE MÁS SECO",
    view_count: 2_900_000,
    thumbnail: null,
};

describe("share", () => {
    it("puts the playable clip and the store link in every message", () => {
        const message = buildShareMessage(item, "player");
        expect(message).toContain("EL KEKE MÁS SECO");
        expect(message).toContain(
            "https://www.youtube.com/watch?v=UOGCSLbFIkE"
        );
        expect(message).toMatch(/play\.google\.com|apps\.apple\.com/);
    });

    it("tags the store link so installs can be attributed to the clip", () => {
        // The tag is carried in `referrer` on Android and in the query string
        // on iOS, so assert on the decoded content rather than the shape.
        const url = decodeURIComponent(storeUrl("shorts", item.id));
        expect(url).toContain("utm_source=app_share");
        expect(url).toContain("utm_medium=shorts");
        expect(url).toContain(`utm_content=${item.id}`);
    });

    it("uses the shorts URL shape for shorts", () => {
        const message = buildShareMessage({...item, kind: "short"}, "shorts");
        expect(message).toContain("https://www.youtube.com/shorts/UOGCSLbFIkE");
    });
});
