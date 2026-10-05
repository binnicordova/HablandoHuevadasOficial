type ObserveModule = typeof import("@/services/observe");

const Root = () => null;

const NATIVE_MODULES = ["ExpoAppMetrics", "ExpoObserve"];

/**
 * Loads `services/observe` against a fresh module registry, with the native
 * modules either present (a build that ships expo-observe) or absent (Expo Go,
 * a store binary from before it). `expo-observe` itself is a stub that throws
 * on load without them, as the real package's `requireNativeModule` does.
 */
const loadObserve = (hasNativeModules: boolean, channel: string | null) => {
    const fake = {
        Observe: {configure: jest.fn(), reportError: jest.fn()},
        ObserveRoot: {wrap: jest.fn(() => Root)},
    };
    let observe: ObserveModule | undefined;

    jest.isolateModules(() => {
        jest.doMock("expo", () => ({
            requireOptionalNativeModule: (name: string) =>
                hasNativeModules && NATIVE_MODULES.includes(name) ? {} : null,
        }));
        jest.doMock("expo-updates", () => ({channel}));
        jest.doMock("expo-observe", () => {
            if (!hasNativeModules) {
                throw new Error("Cannot find native module 'ExpoAppMetrics'");
            }
            return fake;
        });
        observe = require("@/services/observe");
    });

    return {observe: observe as ObserveModule, fake};
};

describe("observe without the native module", () => {
    it("never loads expo-observe, so Expo Go and older binaries boot", () => {
        const {observe} = loadObserve(false, "production");

        expect(() => observe.configureObserve()).not.toThrow();
        expect(() => observe.reportError(new Error("boom"))).not.toThrow();
    });

    it("leaves the root layout as it was", () => {
        const Layout = () => null;
        const {observe} = loadObserve(false, "production");

        expect(observe.withObserveRoot(Layout)).toBe(Layout);
    });
});

describe("observe with the native module", () => {
    it("reports the build's channel as the environment", () => {
        const {observe, fake} = loadObserve(true, "preview");

        observe.configureObserve();

        expect(fake.Observe.configure).toHaveBeenCalledWith({
            environment: "preview",
            integrations: {"expo-router": true},
        });
    });

    it("leaves the environment to Observe when there is no channel", () => {
        const {observe, fake} = loadObserve(true, null);

        observe.configureObserve();

        expect(fake.Observe.configure).toHaveBeenCalledWith(
            expect.objectContaining({environment: undefined})
        );
    });

    it("wraps the root layout and forwards caught errors", () => {
        const Layout = () => null;
        const error = new Error("boom");
        const {observe, fake} = loadObserve(true, "production");

        expect(observe.withObserveRoot(Layout)).toBe(Root);
        expect(fake.ObserveRoot.wrap).toHaveBeenCalledWith(Layout);

        observe.reportError(error);
        expect(fake.Observe.reportError).toHaveBeenCalledWith(error);
    });
});
