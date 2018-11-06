import { ControlLabel, FormControl, FormGroup } from "react-bootstrap";
import { Input } from "../Input";

describe("<Input />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        props = {
            label: "test_label",
            name: "test_input",
            type: "select",
            rows: 1,
            value: 1,
            min: 0,
            max: 10,
            step: 1,
            readOnly: false,
            onInvalid: jest.fn(),
            placeholder: "test_placeholder",
            autoComplete: false,
            error: "test_error",
            onHide: jest.fn(),
            onBlur: jest.fn(),
            onFocus: jest.fn(),
            onChange: jest.fn(),
            style: { width: "100px" },
            formGroupStyle: {},
            children: <option>Test Node</option>,
            noMargin: true,
            disabled: false
        };
        wrapper = mount(<Input {...props} />);
        wrapper.instance().blur();
        wrapper.instance().focus();

        expect(wrapper).toMatchSnapshot();
    });

    it("renders a FormGroup", () => {
        wrapper = shallow(<Input />);

        expect(wrapper.find(FormGroup).length).toEqual(1);
        expect(wrapper.find(FormGroup)).toMatchSnapshot();
    });

    it("renders the appropriate input type depending on [props.type]", () => {
        props = {
            name: "i-test",
            type: "textarea"
        };
        wrapper = shallow(<Input {...props} />);
        expect(wrapper.find(FormControl).prop("componentClass")).toEqual(props.type);

        props.type = "select";
        wrapper = shallow(<Input {...props} />);
        expect(wrapper.find(FormControl).prop("componentClass")).toEqual(props.type);

        props.type = "number";
        wrapper = shallow(<Input {...props} />);
        const expected = {
            paddingRight: "12px"
        };
        expect(wrapper.find(FormControl).prop("style")).toEqual(expected);
    });

    it("renders two children: optional ControlLabel + FormControl components", () => {
        props = {
            label: "Test Label"
        };
        wrapper = shallow(<Input {...props} />);

        expect(wrapper.find(ControlLabel).length).toBe(1);
        expect(wrapper.find(ControlLabel)).toMatchSnapshot();
        expect(wrapper.find(FormControl).length).toBe(1);
        expect(wrapper.find(FormControl)).toMatchSnapshot();
    });
});
