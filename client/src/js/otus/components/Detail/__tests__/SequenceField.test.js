import SequenceField, { SequenceFieldTextArea } from "../SequenceField";

describe("<SequenceField />", () => {
    let props;

    beforeEach(() => {
        props = {
            sequence: "ACTG",
            readOnly: false,
            onChange: jest.fn(),
            error: ""
        };
    });

    it("should render", () => {
        const wrapper = shallow(<SequenceField {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [readOnly=true]", () => {
        props.readOnly = true;
        const wrapper = shallow(<SequenceField {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with error", () => {
        props.error = "Invalid sequence";
        const wrapper = shallow(<SequenceField {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onChange() when input changes", () => {
        const wrapper = shallow(<SequenceField {...props} />);
        const e = {
            target: {
                value: "GTAC"
            }
        };
        wrapper.find(SequenceFieldTextArea).simulate("change", e);
        expect(props.onChange).toHaveBeenCalledWith(e);
    });
});
