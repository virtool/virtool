import { FormControl } from "react-bootstrap";
import { InputSave } from "./InputSave";
import { Flex, FlexItem, Button } from "./index";

describe("<InputSave />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
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
            disabled: false,
            noMargin: true,
            error: "test error"
        };
        wrapper = mount(<InputSave {...props} />);
        wrapper.instance().focus();
        wrapper.instance().blur();

        expect(wrapper).toMatchSnapshot();
    });

    describe("renders subcomponents:", () => {
        beforeEach(() => {
            props = {
                onSave: jest.fn(),
                label: "Test Label"
            };
            wrapper = shallow(<InputSave {...props} />);
        });

        it("renders main <form> element", () => {
            expect(wrapper.find("form").length).toEqual(1);
            expect(wrapper).toMatchSnapshot();
        });

        it("renders two subcomponents: <h5> label element and Flex component", () => {
            expect(wrapper.children().length).toEqual(2);
            expect(wrapper.find("h5").length).toEqual(1);
            expect(wrapper.find(Flex).length).toEqual(1);
        });

        it("<h5> subcomponent displays label when provided", () => {
            expect(wrapper.find("h5 > strong").text()).toEqual(props.label);
        });

        it("Flex component contains a FlexItem and Button components", () => {
            expect(wrapper.find(Flex).children().length).toEqual(2);
            expect(wrapper.find(FlexItem).length).toEqual(1);
            expect(wrapper.find(Button).length).toEqual(1);
        });
    });

    describe("FlexItem subcomponent", () => {
        beforeEach(() => {
            props = {
                onSave: jest.fn()
            };
            wrapper = shallow(<InputSave {...props} />);
        });

        it("wraps a FormControl component", () => {
            expect(wrapper.find(FormControl).length).toEqual(1);
        });
    });

    describe("componentDidUpdate:", () => {
        let spy;

        beforeAll(() => {
            spy = sinon.spy(InputSave.prototype, "componentDidUpdate");

            props = { onSave: jest.fn(), initialValue: "foo" };
            wrapper = shallow(<InputSave {...props} />);
        });

        afterAll(() => {
            spy.restore();
        });

        it("if current and past props initialValue field are not equal, update state", () => {
            spy.resetHistory();

            expect(spy.called).toBe(false);
            expect(wrapper.state("value")).toEqual("foo");

            wrapper.setProps({ initialValue: "bar" });
            expect(spy.called).toBe(true);
            expect(wrapper.state("value")).toEqual("bar");
        });

        it("otherwise no change", () => {
            wrapper.setState({ value: "test" });
            spy.resetHistory();

            expect(spy.called).toBe(false);

            // No change in value with new props
            wrapper.setProps({ initialValue: "test" });
            expect(spy.called).toBe(true);
            expect(wrapper.state("value")).toEqual("test");
        });
    });

    describe("handleChange:", () => {
        let spy;
        let mockEvent;

        afterEach(() => {
            spy.restore();
        });

        it("should not update state if [props.disabled=true]", () => {
            props = {
                onSave: jest.fn(),
                onChange: jest.fn(),
                initialValue: "test",
                disabled: true
            };
            mockEvent = {
                target: {
                    value: "new_value"
                }
            };
            wrapper = mount(<InputSave {...props} />);

            spy = sinon.spy(wrapper.instance(), "handleChange");
            wrapper.instance().forceUpdate();

            expect(wrapper.state("value")).toEqual(props.initialValue);

            wrapper.find(FormControl).simulate("change", mockEvent);

            expect(spy.calledOnce).toBe(true);
            expect(props.onChange).toHaveBeenCalled();

            expect(wrapper.state("value")).not.toEqual(mockEvent.target.value);
        });

        it("should update state if [props.disabled=false]", () => {
            props = {
                onSave: jest.fn(),
                onChange: undefined,
                initialValue: "test",
                disabled: false,
                type: "submit"
            };
            mockEvent = {
                target: {
                    value: "new_value"
                }
            };

            // Since getDerivedStateFromProps will interfere with setting state,
            // must mock it for this test
            const originalMethod = InputSave.getDerivedStateFromProps;
            InputSave.getDerivedStateFromProps = () => null;

            wrapper = mount(<InputSave {...props} />);

            spy = sinon.spy(wrapper.instance(), "handleChange");
            wrapper.instance().forceUpdate();

            expect(spy.called).toBe(false);
            expect(wrapper.state("value")).toEqual(props.initialValue);

            wrapper.find("input").simulate("change", mockEvent);

            expect(spy.calledOnce).toBe(true);
            expect(wrapper.state("value")).toEqual(mockEvent.target.value);

            // Restore original getDerivedStateFromProps method
            InputSave.getDerivedStateFromProps = originalMethod;
        });

        it("should not call onChange props if it is not supplied", () => {
            props = {
                onSave: jest.fn(),
                onChange: undefined,
                initialValue: "test",
                disabled: true
            };
            mockEvent = {
                target: {
                    value: "new_value"
                }
            };
            wrapper = mount(<InputSave {...props} />);

            spy = sinon.spy(wrapper.instance(), "handleChange");
            wrapper.instance().forceUpdate();

            expect(spy.called).toBe(false);
            expect(() => {
                wrapper.find(FormControl).simulate("change");
            }).not.toThrow();
            expect(spy.calledOnce).toBe(true);
        });
    });

    describe("handleBlur: should handle input and button blur depending on click placement", () => {
        let spy;
        let mockEvent;

        beforeEach(() => {
            props = {
                onSave: jest.fn(),
                onChange: jest.fn(),
                initialValue: "test"
            };
            wrapper = mount(<InputSave {...props} />);

            spy = jest.spyOn(wrapper.instance(), "handleBlur");
            wrapper.instance().forceUpdate();
        });

        afterEach(() => {
            spy.mockReset();
            spy.mockRestore();
        });

        it("should reset input value if blur is caused by clicking on a different focus element", () => {
            mockEvent = {
                relatedTarget: {
                    type: "not-submit"
                }
            };
            wrapper.find(FormControl).simulate("blur", mockEvent);

            expect(spy).toHaveBeenCalled();
            expect(wrapper.state("value")).toEqual(props.initialValue);
        });

        it("should reset input value if blur is caused by clicking on a non focus element", () => {
            mockEvent = {};
            wrapper.find(FormControl).simulate("blur", mockEvent);

            expect(spy).toHaveBeenCalled();
            expect(wrapper.state("value")).toEqual(props.initialValue);
        });

        it("should save input value if the blur is caused by a valid submit event", () => {
            mockEvent = {
                relatedTarget: {
                    type: "submit"
                }
            };
            wrapper.find(FormControl).simulate("blur", mockEvent);

            expect(spy).toHaveBeenCalled();
            expect(props.onChange).toHaveBeenCalled();
        });

        it("should not call onChange props if it is not supplied", () => {
            props = {
                onSave: jest.fn(),
                onChange: undefined,
                initialValue: "test"
            };
            wrapper = mount(<InputSave {...props} />);

            const spyAlternate = jest.spyOn(wrapper.instance(), "handleBlur");
            wrapper.instance().forceUpdate();

            mockEvent = {
                relatedTarget: {
                    type: "submit"
                }
            };

            expect(spyAlternate).not.toHaveBeenCalled();
            expect(() => {
                wrapper.find(FormControl).simulate("blur", mockEvent);
            }).not.toThrow();
            expect(spyAlternate).toHaveBeenCalled();

            spyAlternate.mockReset();
            spyAlternate.mockRestore();
        });
    });

    describe("Button subcomponent, handleSubmit:", () => {
        let spyHandler;
        let spyBlur;

        beforeEach(() => {
            props = {
                onSave: jest.fn(),
                initialValue: "initial_value"
            };
            wrapper = mount(<InputSave {...props} />);

            spyHandler = sinon.spy(wrapper.instance(), "handleSubmit");
            spyBlur = sinon.spy(wrapper.instance(), "blur");

            wrapper.instance().forceUpdate();
        });

        afterEach(() => {
            spyHandler.restore();
            spyBlur.restore();
        });

        it("when there is no change in value, click/enter triggers submit handler and blur", () => {
            wrapper.find(Button).simulate("submit");

            expect(spyHandler.calledOnce).toBe(true);
            expect(spyBlur.calledOnce).toBe(true);
        });

        it("when there is a change in value, click/enter sets [state.pending=true] and calls the onSave prop", () => {
            wrapper.setState({ value: "CHANGED" });
            wrapper.find(Button).simulate("submit");

            expect(spyHandler.calledOnce).toBe(true);
            expect(wrapper.state("pending")).toEqual(true);
            expect(props.onSave).toHaveBeenCalled();
        });
    });
});
