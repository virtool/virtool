import { Input, TextArea } from "../../../base";
import { ReferenceForm } from "../Form";

describe("<ReferenceForm />", () => {
    let props;

    beforeEach(() => {
        props = {
            description: "Foo reference",
            errorName: "baz",
            mode: "clone",
            name: "Foo",
            organism: "Bar",
            onChange: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<ReferenceForm {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render error when provided in props", () => {
        props.errorName = "Name required";
        const wrapper = shallow(<ReferenceForm {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render organism field when [mode=create]", () => {
        props.mode = "create";
        const wrapper = shallow(<ReferenceForm {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it.each(["name", "organism", "description"])("should call onChange() when %p input changes", name => {
        props.mode = "create";
        const wrapper = shallow(<ReferenceForm {...props} />);
        const e = { target: { name, value: "Baz" } };
        wrapper
            .find(name === "description" ? TextArea : Input)
            .at(name === "organism" ? 1 : 0)
            .simulate("change", e);
        expect(props.onChange).toHaveBeenCalledWith(e);
    });
});
