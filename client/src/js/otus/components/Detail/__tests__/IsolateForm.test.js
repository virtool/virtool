import { IsolateForm } from "../IsolateForm";

describe("<IsolateForm />", () => {
    let props;

    beforeEach(() => {
        props = {
            sourceType: "baz",
            sourceName: "Foo",
            allowedSourceTypes: ["foo", "bar"],
            restrictSourceTypes: true,
            onChange: jest.fn(),
            onSubmit: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<IsolateForm {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call changeSourceName when input changes", () => {
        const e = {
            target: {
                value: "bar"
            }
        };
        const wrapper = shallow(<IsolateForm {...props} />);
        wrapper
            .find("InputError")
            .at(0)
            .prop("onChange")(e);
        expect(props.onChange).toHaveBeenCalledWith({
            sourceName: "bar",
            sourceType: "baz"
        });
    });

    const func = ({ e }) => {
        const wrapper = shallow(<IsolateForm {...props} />);
        wrapper.find("SourceTypeInput").prop("onChange")(e);
        return props.onChange;
    };

    test.each([
        [
            { e: { target: { value: "unknown" } } },
            {
                sourceName: "",
                sourceType: "unknown"
            }
        ],
        [
            { e: { target: { value: "bar" } } },
            {
                sourceName: "Foo",
                sourceType: "bar"
            }
        ]
    ])(".match(%o, %o)", (input, expected) => {
        expect(func(input)).toHaveBeenCalledWith(expected);
    });
});
