import { Input } from "./Input";
import { ControlLabel, FormControl, FormGroup } from "react-bootstrap";

describe("<Input />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        props = {
            label: "test_label",
            name: "test_input",
            type: "number",
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
            children: <div>Test Node</div>,
            noMargin: true,
            disabled: false
        };
        wrapper = shallow(<Input {...props} />);

        expect(wrapper).toMatchSnapshot();
    });

    it("renders a FormGroup", () => {
        wrapper = shallow(<Input />);

        expect(wrapper.find(FormGroup).length).toEqual(1);
        expect(wrapper.find(FormGroup)).toMatchSnapshot();
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
