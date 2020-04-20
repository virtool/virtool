import { LoadingPlaceholder } from "../LoadingPlaceholder";

describe("<LoadingPlaceholder />", () => {
    it("should render", () => {
        const wrapper = shallow(<LoadingPlaceholder />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render the provided message", () => {
        const wrapper = shallow(<LoadingPlaceholder message="Test Message" />);
        expect(wrapper).toMatchSnapshot();
    });
});
