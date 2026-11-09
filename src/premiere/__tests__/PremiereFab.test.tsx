import {act, fireEvent, render} from "@testing-library/react-native";
import {createStore, type PrimitiveAtom, Provider} from "jotai";
import {Text} from "react-native";
import type {CatalogItem} from "@/models/video";
import {PremiereFab} from "@/premiere/presentation/PremiereFab";
import {videosAtom} from "@/stores/store";

jest.mock("@/stores/store", () => {
    const {atom} = require("jotai");
    return {videosAtom: atom([])};
});
jest.mock("@/catalog", () => ({syncCatalog: jest.fn()}));
// The real module needs the native worklets runtime, which Jest does not have.
jest.mock("react-native-reanimated", () => {
    const {View} = require("react-native");
    return {
        __esModule: true,
        default: {View},
        Easing: {out: () => () => 0, quad: () => 0},
        cancelAnimation: jest.fn(),
        useAnimatedStyle: () => ({}),
        useReducedMotion: () => false,
        useSharedValue: (value: number) => ({value}),
        withRepeat: (value: number) => value,
        withTiming: (value: number) => value,
    };
});

const NOW = Date.parse("2026-11-08T19:00:00-05:00");
const MIN = 60_000;

const video = (extra: Partial<CatalogItem>): CatalogItem => ({
    id: "premiere",
    link: "https://www.youtube.com/watch?v=premiere",
    title: "premiere",
    view_count: null,
    thumbnail: null,
    kind: "video",
    ...extra,
});

const renderFab = (item: CatalogItem, onPlay = jest.fn()) => {
    const store = createStore();
    store.set(videosAtom as unknown as PrimitiveAtom<CatalogItem[]>, [item]);
    const utils = render(
        <Provider store={store}>
            <PremiereFab
                bottom={100}
                onPlay={onPlay}
                fallback={<Text>fallback</Text>}
            />
        </Provider>
    );
    return {...utils, onPlay};
};

describe("PremiereFab", () => {
    beforeEach(() => {
        jest.useFakeTimers({now: NOW});
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    it("renders the fallback when nothing is pending", () => {
        const {getByText} = renderFab(video({}));
        expect(getByText("fallback")).toBeTruthy();
    });

    it("shows the countdown with a spoken label", () => {
        const {getByText, getByLabelText} = renderFab(
            video({
                premiere_at: new Date(NOW + 112 * MIN + 30_000).toISOString(),
            })
        );
        expect(getByText("1h 52m")).toBeTruthy();
        expect(getByLabelText("Se estrena en 1 hora 52 minutos")).toBeTruthy();
    });

    it("explains instead of playing while the premiere is pending", () => {
        const {getByRole, getByText, queryByText, onPlay} = renderFab(
            video({premiere_at: new Date(NOW + 60 * MIN).toISOString()})
        );
        expect(queryByText(/Se estrena el/)).toBeNull();

        fireEvent.press(getByRole("button"));
        expect(onPlay).not.toHaveBeenCalled();
        expect(getByText(/Se estrena el/)).toBeTruthy();

        act(() => {
            jest.advanceTimersByTime(3500);
        });
        expect(queryByText(/Se estrena el/)).toBeNull();
    });

    it("turns into a play button once live", () => {
        const {getByRole, getByText, onPlay} = renderFab(
            video({
                live_status: "upcoming",
                premiere_at: new Date(NOW + 2000).toISOString(),
            })
        );

        act(() => {
            jest.advanceTimersByTime(2000);
        });
        expect(getByText("¡Ya salió!")).toBeTruthy();

        fireEvent.press(getByRole("button"));
        expect(onPlay).toHaveBeenCalledWith("premiere");
    });
});
