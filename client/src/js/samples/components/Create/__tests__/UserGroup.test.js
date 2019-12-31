import { SampleUserGroup } from "../UserGroup";

describe("SampleUserGroup", () => {
    let props;
    beforeEach(() => {
        props = {
            groups: ["foo"],
            onChange: jest.fn(),
            group: "bar"
        };
    });

    it("should render", () => {
        const wrapper = shallow(<SampleUserGroup {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should call onChange when InputError is changed", () => {
        const e = {
            target: "foo"
        };
        const wrapper = shallow(<SampleUserGroup {...props} />);
        wrapper.find("InputError").simulate("change", e);
        expect(props.onChange).toHaveBeenCalledWith({ target: "foo" });
    });
});
