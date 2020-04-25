import { Button } from "../Button";

describe("<Button />", () => {
    let props;

    beforeEach(() => {
        props = {
            onClick: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<Button {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with icon", () => {
        props.icon = "folder";
        const wrapper = shallow(<Button {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with children", () => {
        const wrapper = shallow(
            <Button {...props}>
                <span>Test</span>
            </Button>
        );
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with tooltip", () => {
        props.tip = "Tooltip";
        const wrapper = shallow(<Button {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with tooltip using tipPlacement prop", () => {
        props.tip = "Tooltip";
        props.tipPlacement = "left";
        const wrapper = shallow(<Button {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onClick() prop when clicked", () => {
        const wrapper = shallow(<Button {...props} />);
        wrapper.simulate("click");
        expect(props.onClick).toHaveBeenCalled();
    });
});
