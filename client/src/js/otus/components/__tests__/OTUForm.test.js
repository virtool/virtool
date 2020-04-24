import { Input } from "../../../base";
import { OTUForm } from "../Form";

describe("<OTUForm />", () => {
    let props;

    beforeEach(() => {
        props = {
            onSubmit: jest.fn(),
            onChange: jest.fn(),
            name: "test",
            abbreviation: "T",
            error: ""
        };
    });

    it("should render", () => {
        const wrapper = shallow(<OTUForm {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with error", () => {
        props.error = "Name is used already";
        const wrapper = shallow(<OTUForm {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it.each(["name", "abbreviation"])("should call onChange() when %p changes", name => {
        const wrapper = shallow(<OTUForm {...props} />);
        const e = {
            target: {
                name,
                value: name === "name" ? "Foo" : "F"
            }
        };
        wrapper
            .find(Input)
            .at(name === "name" ? 0 : 1)
            .simulate("change", e);

        expect(props.onChange).toHaveBeenCalledWith(e);
    });

    it("should call onSubmit() when submitted", () => {
        const wrapper = shallow(<OTUForm {...props} />);
        const e = {};
        wrapper.find("form").simulate("submit", e);
        expect(props.onSubmit).toHaveBeenCalledWith(e);
    });
});
