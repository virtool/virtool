import { Checkbox, Input } from "../../../../../base";
import { TargetForm } from "../Form";

describe("<TargetForm />", () => {
    const props = {
        description: "bar",
        errorName: "",
        length: 1,
        name: "foo",
        required: false,
        onChange: jest.fn(),
        onClick: jest.fn()
    };

    it("should render", () => {
        const wrapper = shallow(<TargetForm {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with error", () => {
        props.error = "Name required";
        const wrapper = shallow(<TargetForm {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it.each(["name", "description", "length"])("should call onChange() when %p input changes", name => {
        const wrapper = shallow(<TargetForm {...props} />);
        const value = name === "length" ? "5" : "foo";
        const e = { target: { name, value } };
        wrapper.find(`[name="${name}"]`).simulate("change", e);
        expect(props.onChange).toHaveBeenCalledWith(e);
    });

    it("should call onClick() when checkbox clicked", () => {
        const wrapper = shallow(<TargetForm {...props} />);
        wrapper.find(Checkbox).simulate("click", { foo: "bar" });
        expect(props.onClick).toHaveBeenCalledWith({ foo: "bar" });
    });
});
