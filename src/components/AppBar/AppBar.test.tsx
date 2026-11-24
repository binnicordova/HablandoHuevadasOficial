import {render} from "@testing-library/react-native";
import {AppBar} from "./AppBar";

const mockCanGoBack = jest.fn(() => false);

jest.mock("expo-router", () => ({
    router: {canGoBack: () => mockCanGoBack(), back: jest.fn()},
    useCanGoBack: () => mockCanGoBack(),
}));

const TITLE = "Test Title";

describe("AppBar", () => {
    beforeEach(() => {
        mockCanGoBack.mockReturnValue(false);
    });

    it("renders the title correctly", async () => {
        const {getByText} = await render(<AppBar title={TITLE} />);
        expect(getByText(TITLE)).toBeTruthy();
    });

    it("does not render back button when canGoBack is false", async () => {
        const {queryByTestId} = await render(<AppBar title={TITLE} />);
        expect(queryByTestId("back-button")).toBeNull();
    });

    it("renders the back button when navigation can go back", async () => {
        mockCanGoBack.mockReturnValue(true);
        const {getByTestId} = await render(<AppBar title={TITLE} />);
        expect(getByTestId("back-button")).toBeTruthy();
    });
});
