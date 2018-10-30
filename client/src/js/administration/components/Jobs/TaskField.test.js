import { InputError } from "../../../base";
import TaskField from "./TaskField";

describe("<TaskField />", () => {
    let props;
    let wrapper;
    let spy;
    const mockEvent = { preventDefault: jest.fn() };

    it("renders correctly", () => {
        props = {
            name: "test",
            value: 3,
            readOnly: false,
            lowerLimit: 1,
            upperLimit: 10,
            onInvalid: jest.fn(),
            onChange: jest.fn(),
            clear: jest.fn()
        };
        wrapper = shallow(<TaskField {...props} />);
        expect(wrapper).toMatchSnapshot();

        wrapper = shallow(<TaskField />);
        expect(wrapper).toMatchSnapshot();
    });

    it("componentDidUpdate: change in props.value updates state", () => {
        wrapper = shallow(<TaskField value={1} />);
        expect(wrapper.state()).toEqual({ value: 1, pending: false });

        wrapper.setProps({ value: 6 });
        expect(wrapper.state()).toEqual({ value: 6, pending: false });
    });

    it("handleBlur: if pending state is false, reset value; otherwise call props.clear callback", () => {
        const spy = sinon.spy();
        expect(spy.called).toBe(false);

        wrapper = mount(<TaskField value={7} clear={spy} />);
        wrapper.find(InputError).prop("onBlur")();

        expect(spy.calledOnce).toBe(true);
        expect(wrapper.state()).toEqual({ value: 7, pending: false });

        wrapper.setState({ value: 0, pending: true });
        wrapper.find(InputError).prop("onBlur")();

        expect(spy.calledTwice).toBe(true);
        expect(wrapper.state()).toEqual({ value: 0, pending: true });
    });

    it("handleChange: input changes sets state.value to event value", () => {
        wrapper = mount(<TaskField value={7} />);
        expect(wrapper.state("value")).toEqual(7);

        wrapper.find(InputError).prop("onChange")({ target: { value: 3 } });
        expect(wrapper.state("value")).toEqual(3);
    });

    it("handleInvalid: input invalidation calls props.onInvalid callback", () => {
        spy = sinon.spy();
        expect(spy.called).toBe(false);

        wrapper = mount(<TaskField onInvalid={spy} />);
        wrapper.find(InputError).prop("onInvalid")(mockEvent);

        expect(spy.calledWith(mockEvent)).toBe(true);
    });

    it("handleSubmit: form submit calls props.onChange & props.onInvalid callback when state.value is set", () => {
        props = {
            onInvalid: jest.fn(),
            onChange: sinon.spy(),
            name: "test"
        };
        wrapper = mount(<TaskField {...props} />);

        wrapper.find("form").prop("onSubmit")(mockEvent);
        expect(props.onInvalid).toHaveBeenCalled();
        expect(props.onChange.called).toBe(false);

        wrapper.setState({ value: 2, pending: false });
        wrapper.find("form").prop("onSubmit")(mockEvent);
        expect(wrapper.state()).toEqual({ value: 2, pending: true });
        expect(props.onChange.calledWith("test", 2)).toBe(true);
    });
});
