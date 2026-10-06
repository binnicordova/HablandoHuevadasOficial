type ObserveModule = typeof import("@/services/observe");

type Runtime = {
    expoGo: boolean;
    nativeModules: boolean;
    channel: string | null;
};

const NATIVE_MODULES = ["ExpoAppMetrics", "ExpoObserve"];
const Root = () => null;

const loadObserve = ({expoGo, nativeModules, channel}: Runtime) => {
    const fake = {
        Observe: {configure: jest.fn(), reportError: jest.fn()},
        ObserveRoot: {wrap: jest.fn(() => Root)},
    };
    const probe = jest.fn((name: string) =>
        nativeModules && NATIVE_MODULES.includes(name) ? {} : null
    );
    const loadedPackage = jest.fn();
    let observe: ObserveModule | undefined;

    jest.isolateModules(() => {
        jest.doMock("@/utils/notification", () => ({isExpoGo: expoGo}));
        jest.doMock("expo", () => ({requireOptionalNativeModule: probe}));
        jest.doMock("expo-updates", () => ({channel}));
        jest.doMock("expo-observe", () => {
            loadedPackage();
            if (!nativeModules) {
                throw new Error("Cannot find native module 'ExpoAppMetrics'");
            }
            return fake;
        });
        observe = require("@/services/observe");
    });

    return {observe: observe as ObserveModule, fake, probe, loadedPackage};
};

describe("observe in Expo Go", () => {
    afterEach(() => jest.restoreAllMocks());

    it("stops at the Expo Go check without probing or loading anything", () => {
        const {observe, probe, loadedPackage} = loadObserve({
            expoGo: true,
            nativeModules: false,
            channel: null,
        });

        expect(observe.OBSERVE_SUPPORTED).toBe(false);
        expect(probe).not.toHaveBeenCalled();
        expect(loadedPackage).not.toHaveBeenCalled();
    });

    it("says it is off once, as a log rather than an error", () => {
        const log = jest.spyOn(console, "log").mockImplementation(() => {});
        const error = jest.spyOn(console, "error");
        const warn = jest.spyOn(console, "warn");
        const {observe} = loadObserve({
            expoGo: true,
            nativeModules: false,
            channel: null,
        });

        observe.configureObserve();

        expect(log).toHaveBeenCalledWith(
            expect.stringContaining("[Observe] Disabled in Expo Go")
        );
        expect(error).not.toHaveBeenCalled();
        expect(warn).not.toHaveBeenCalled();
    });

    it("leaves the root layout and error reporting as no-ops", () => {
        const Layout = () => null;
        const {observe} = loadObserve({
            expoGo: true,
            nativeModules: false,
            channel: null,
        });

        expect(observe.withObserveRoot(Layout)).toBe(Layout);
        expect(() => observe.reportError(new Error("boom"))).not.toThrow();
    });
});

describe("observe in a store binary built before expo-observe", () => {
    it("never loads the package and stays silent", () => {
        const log = jest.spyOn(console, "log").mockImplementation(() => {});
        const {observe, loadedPackage} = loadObserve({
            expoGo: false,
            nativeModules: false,
            channel: "production",
        });

        observe.configureObserve();

        expect(observe.OBSERVE_SUPPORTED).toBe(false);
        expect(loadedPackage).not.toHaveBeenCalled();
        expect(log).not.toHaveBeenCalled();
        log.mockRestore();
    });
});

describe("observe in a build that ships expo-observe", () => {
    it("reports the build's channel as the environment", () => {
        const {observe, fake} = loadObserve({
            expoGo: false,
            nativeModules: true,
            channel: "preview",
        });

        observe.configureObserve();

        expect(fake.Observe.configure).toHaveBeenCalledWith({
            environment: "preview",
            integrations: {"expo-router": true},
        });
    });

    it("leaves the environment to Observe when there is no channel", () => {
        const {observe, fake} = loadObserve({
            expoGo: false,
            nativeModules: true,
            channel: null,
        });

        observe.configureObserve();

        expect(fake.Observe.configure).toHaveBeenCalledWith(
            expect.objectContaining({environment: undefined})
        );
    });

    it("wraps the root layout and forwards caught errors", () => {
        const Layout = () => null;
        const error = new Error("boom");
        const {observe, fake} = loadObserve({
            expoGo: false,
            nativeModules: true,
            channel: "production",
        });

        expect(observe.withObserveRoot(Layout)).toBe(Root);
        expect(fake.ObserveRoot.wrap).toHaveBeenCalledWith(Layout);

        observe.reportError(error);
        expect(fake.Observe.reportError).toHaveBeenCalledWith(error);
    });
});
