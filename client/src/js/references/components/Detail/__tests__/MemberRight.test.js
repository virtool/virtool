import { MemberRight, MemberRightCheckbox } from "../MemberRight";

describe("<MemberRight />", () => {
    let props;

    beforeEach(() => {
        props = {
            right: "build",
            enabled: true,
            onToggle: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<MemberRight {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when right is modify_otu", () => {
        props.right = "modify_otu";
        const wrapper = shallow(<MemberRight {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when right is not enabled", () => {
        props.enabled = false;
        const wrapper = shallow(<MemberRight {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it.each([true, false])("should have onToggle called on Checkbox click when [enabled=%p]", enabled => {
        props.enabled = enabled;
        const wrapper = mount(<MemberRight {...props} />);
        wrapper.find(MemberRightCheckbox).prop("onClick")();
        expect(props.onToggle).toHaveBeenCalledWith(props.right, !enabled);
    });
});
