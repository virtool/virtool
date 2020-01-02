import { FormControl } from "react-bootstrap";
import { InputSave } from "../InputSave";
import { Flex, FlexItem, Button } from "../index";

describe("<InputSave />", () => {
    let props;
    let state;
    const blur = jest.fn();
    const e = {
        target: {
            value: "foo"
        },
        preventDefault: jest.fn()
    };
    beforeEach(() => {
        props = {
            name: "test_inputsave",
            onSave: jest.fn(),
            label: "Test Label",
            type: "number",
            min: 0,
            max: 10,
            step: 1,
            initialValue: 5,
            autoComplete: false,
            onInvalid: jest.fn(),
            onChange: jest.fn(),
            onBlur: jest.fn(),
            disabled: false,
            noMargin: true,
            error: "test error"
        };
        state = {
            pending: false,
            value: 5
        };
    });

    it("should render", () => {
        const wrapper = shallow(<InputSave {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("componentDidUpdate() should update state when [this.props.initialValue!=prevProps.initialValue]", () => {
        const wrapper = shallow(<InputSave {...props} />);
        expect(wrapper.state().value).toBe(5);
        wrapper.setState({
            pending: true,
            value: 8
        });
        wrapper.setProps({
            initialValue: 9
        });
        expect(wrapper.state()).toEqual({ pending: false, value: 9 });
    });

    it("should not update state when [this.props.initialValue=prevProps.initialValue]", () => {
        const wrapper = shallow(<InputSave {...props} />);
        expect(wrapper.state()).toEqual({ pending: false, value: 5 });
    });

    it("handleBlur should update state when [this.props.disable=false]", () => {
        const wrapper = mount(<InputSave {...props} />);
        wrapper.setState({ value: 6 });
        wrapper.find("FormControl").simulate("blur");
        expect(wrapper.state().value).toBe(5);
    });

    it("handleChange should update state when [this.props.disabled=false]]", () => {
        const wrapper = shallow(<InputSave {...props} />);
        wrapper.find("FormControl").simulate("change", e);
        expect(wrapper.state()).toEqual({ pending: false, value: "foo" });
    });

    it("handleChange should not update state when [this.props.disabled=true]]", () => {
        props.disabled = true;
        const wrapper = shallow(<InputSave {...props} />);
        wrapper.find("FormControl").simulate("change", e);
        expect(wrapper.state()).toEqual({ pending: false, value: 5 });
    });

    it("handleSubmit should call props.onSave when [this.state.value!=this.props.initialValue]", () => {
        const wrapper = mount(<InputSave {...props} />);
        wrapper.setState({ ...state, value: 10 });
        wrapper.find("FormControl").simulate("submit", e);
        expect(props.onSave).toHaveBeenCalledWith({
            max: 10,
            min: 0,
            name: "test_inputsave",
            value: 10
        });
    });

    it("handleSubmit should not call props.onSave when [this.state.value=this.props.initialValue]", () => {
        const wrapper = mount(<InputSave {...props} />);
        wrapper.find("FormControl").simulate("submit", e);
        expect(props.onSave).not.toHaveBeenCalled();
    });

    it("handleSubmit should not call props.onSave when [this.state.value=this.props.initialValue]", () => {
        const wrapper = mount(<InputSave {...props} />);
        wrapper.find("FormControl").simulate("invalid");
        expect(props.onInvalid).toHaveBeenCalled();
    });
});
