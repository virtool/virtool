import { TippyTooltip } from "../Tooltip";

describe("<TippyTooltip />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        wrapper = shallow(<TippyTooltip />);

        expect(wrapper).toMatchSnapshot();
    });

    it("should render when tip prop is provided", () => {
        props = {
            title: "test-header"
        };
        wrapper = shallow(<TippyTooltip {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when position tip is provided", () => {
        props = {
            position: "bottom"
        };
        wrapper = shallow(<TippyTooltip {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
