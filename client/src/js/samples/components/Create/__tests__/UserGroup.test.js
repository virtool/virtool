import { Select } from "../../../../base";
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
        wrapper.find(Select).simulate("change", e);
        expect(props.onChange).toHaveBeenCalledWith({ target: "foo" });
    });
});
