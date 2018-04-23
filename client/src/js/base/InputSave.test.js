import { InputSave } from "./InputSave";
import { FormControl } from "react-bootstrap";
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

    it("should call componentWillReceiveProps on prop change and update state", () => {
        const spy = jest.spyOn(InputSave.prototype, "componentWillReceiveProps");
        
        props = {
            onSave: jest.fn(),
            initialValue: "initial_value"
        };
        wrapper = shallow(<InputSave {...props} />);

        expect(spy).not.toHaveBeenCalled();
        expect(wrapper.state('value')).toEqual(props.initialValue);

        const update = { initialValue: "new_value" };
        wrapper.setProps(update);
        
        expect(spy).toHaveBeenCalled();
        expect(wrapper.state('value')).toEqual(update.initialValue);

        spy.mockReset();
        spy.mockRestore();
    });

    it("should call componentWillReceiveProps and not update if initialValue props have not changed", () => {
        const spy = jest.spyOn(InputSave.prototype, "componentWillReceiveProps");
        
        props = {
            onSave: jest.fn(),
            initialValue: "initial_value"
        };
        wrapper = shallow(<InputSave {...props} />);

        expect(spy).not.toHaveBeenCalled();
        expect(wrapper.state('value')).toEqual(props.initialValue);

        const update = { initialValue: props.initialValue };
        wrapper.setProps(update);
        
        expect(spy).toHaveBeenCalled();
        expect(wrapper.state('value')).toEqual(props.initialValue);

        spy.mockReset();
        spy.mockRestore();
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
            expect(wrapper.find('form').length).toEqual(1);
            expect(wrapper).toMatchSnapshot();
        });
    
        it("renders two subcomponents: <h5> label element and Flex component", () => {
            expect(wrapper.children().length).toEqual(2);
            expect(wrapper.find('h5').length).toEqual(1);
            expect(wrapper.find(Flex).length).toEqual(1);
        });

        it("<h5> subcomponent displays label when provided", () => {
            expect(wrapper.find('h5 > strong').text()).toEqual(props.label);
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

    describe("handleChange:", () => {
        let spy;
        let mockEvent;
        
        it("should update state on input change", () => {
            props = {
                onSave: jest.fn(),
                onChange: jest.fn(),
                initialValue: "test",
                disabled: false
            };
            mockEvent = {
                target: {
                    value: "new_value"
                }
            };
            wrapper = mount(<InputSave {...props} />);
    
            spy = jest.spyOn(wrapper.instance(), "handleChange");
            wrapper.instance().forceUpdate();

            expect(wrapper.state('value')).toEqual(props.initialValue);

            wrapper.find(FormControl).simulate('change', mockEvent);
            
            expect(spy).toHaveBeenCalled();
            expect(props.onChange).toHaveBeenCalled();

            expect(wrapper.state('value')).toEqual(mockEvent.target.value);

            spy.mockReset();
            spy.mockRestore();
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
    
            spy = jest.spyOn(wrapper.instance(), "handleChange");
            wrapper.instance().forceUpdate();

            expect(wrapper.state('value')).toEqual(props.initialValue);

            wrapper.find(FormControl).simulate('change');
            
            expect(spy).toHaveBeenCalled();
            expect(props.onChange).toHaveBeenCalled();

            expect(wrapper.state('value')).not.toEqual(mockEvent.target.value);

            spy.mockReset();
            spy.mockRestore();
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
            wrapper.find(FormControl).simulate('blur', mockEvent);

            expect(spy).toHaveBeenCalled();
            expect(wrapper.state('value')).toEqual(props.initialValue);
        });

        it("should reset input value if blur is caused by clicking on a non focus element", () => {
            mockEvent = {};
            wrapper.find(FormControl).simulate('blur', mockEvent);

            expect(spy).toHaveBeenCalled();
            expect(wrapper.state('value')).toEqual(props.initialValue);
        });

        it("should save input value if the blur is caused by a valid submit event", () => {
            mockEvent = {
                relatedTarget: {
                    type: "submit"
                }
            };
            wrapper.find(FormControl).simulate('blur', mockEvent);

            expect(spy).toHaveBeenCalled();
            expect(props.onChange).toHaveBeenCalled();
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

            spyHandler = jest.spyOn(wrapper.instance(), "handleSubmit");
            spyBlur = jest.spyOn(wrapper.instance(), "blur");

            wrapper.instance().forceUpdate();
        });

        afterEach(() => {
            spyHandler.mockReset();
            spyBlur.mockReset();
            spyHandler.mockRestore();
            spyBlur.mockRestore();
        });

        it("when there is no change in value, click/enter triggers submit handler and blur", () => {
            
            wrapper.find(Button).simulate('submit');

            expect(spyHandler).toHaveBeenCalled();
            expect(spyBlur).toHaveBeenCalled();
        });
        
        it("when there is a change in value, click/enter triggers form submit, handler, setState, onSave, blur", () => {

            expect(wrapper.state('pending')).toBe(false);
            
            const update = { initialValue: "new_value" };
            wrapper.setProps(update);
            wrapper.instance().state.value = "initial_value";

            wrapper.find(Button).simulate('submit');
            
            expect(spyHandler).toHaveBeenCalled();
            expect(props.onSave).toHaveBeenCalled();
            expect(spyBlur).toHaveBeenCalled();
            expect(wrapper.state('pending')).toBe(true);
        });

    });

});
