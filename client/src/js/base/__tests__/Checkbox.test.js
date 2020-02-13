import { Checkbox, StyledCheckbox } from "../Checkbox";

describe("Checkbox", () => {
    let props;
    beforeEach(() => {
        props = {
            checked: false,
            disabled: false,
            onClick: jest.fn(),
            label: "foo"
        };
    });

    it("should render", () => {
        const wrapper = shallow(<Checkbox {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [props.label==='']", () => {
        props.label = "";
        const wrapper = shallow(<Checkbox {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [props.checked===true]", () => {
        props.checked = true;
        const wrapper = shallow(<Checkbox {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onClick when Checkbox is clicked", () => {
        const wrapper = shallow(<Checkbox {...props} />);
        wrapper.find(StyledCheckbox).simulate("click");
        expect(props.onClick).toHaveBeenCalled();
    });

    it("should call onClick when [props.disabled===true] ", () => {
        props.disabled = true;
        const wrapper = shallow(<Checkbox {...props} />);
        wrapper.find(StyledCheckbox).simulate("click");
        expect(props.onClick).not.toHaveBeenCalled();
    });
});
