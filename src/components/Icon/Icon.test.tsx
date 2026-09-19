import {render} from "@testing-library/react-native";
import {Icon} from "./Icon";

jest.mock("@expo/vector-icons", () => {
    const {Text} = require("react-native");
    return {
        MaterialCommunityIcons: (props: {testID?: string}) => (
            <Text testID={props.testID}>icon</Text>
        ),
    };
});

describe("Icon Component", () => {
    it("renders correctly with default props", () => {
        const {getByTestId} = render(<Icon name="home" testID="icon_home" />);
        expect(getByTestId("icon_home")).toBeTruthy();
    });
});
