import { EditLabel, mapDispatchToProps } from "../EditLabel";
import { Modal } from "../../../base";
import { PUSH_STATE } from "../../../app/actionTypes";

describe("<EditLabel>", () => {
    let props, state;
    beforeEach(() => {
        props = {
            id: "1",
            labelName: "FooBar",
            description: "BarFoo",
            color: "#3C8786",
            show: false,
            onHide: jest.fn(),
            onSubmit: jest.fn()
        };
        state = {
            labelName: "FooBar",
            description: "BarFoo",
            color: "#3C8786",
            error: "",
            errorName: "",
            errorColor: ""
        };
    });

    it("should render when [show=false]", () => {
        const wrapper = shallow(<EditLabel {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [show=true]", () => {
        props.show = true;
        const wrapper = shallow(<EditLabel {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should update color on handleColorSelection", () => {
        const wrapper = shallow(<EditLabel {...props} />);
        wrapper.setState({ ...state });
        wrapper.instance().handleColorSelection("#000000");
        expect(wrapper.state()).toEqual({ ...state, color: "#000000" });
    });

    it("should update name on handleChange", () => {
        const wrapper = shallow(<EditLabel {...props} />);
        wrapper.setState({ ...state });
        const e = {
            target: {
                name: "labelName",
                value: "TestName",
                error: ""
            }
        };
        wrapper.instance().handleChange(e);
        expect(wrapper.state()).toEqual({ ...state, labelName: "TestName" });
    });

    it("should return onSubmit() in props", () => {
        const wrapper = shallow(<EditLabel {...props} />);
        wrapper.setState({ ...state });
        const e = {
            preventDefault: jest.fn()
        };
        wrapper.instance().handleSubmit(e);
        expect(props.onSubmit).toHaveBeenCalledWith("1", "FooBar", "BarFoo", "#3C8786");
    });

    it("should submit onSubmit() with no description", () => {
        const wrapper = shallow(<EditLabel {...props} />);
        wrapper.setState({ ...state, description: "" });
        const e = {
            preventDefault: jest.fn()
        };
        wrapper.instance().handleSubmit(e);
        expect(props.onSubmit).toHaveBeenCalledWith("1", "FooBar", "", "#3C8786");
    });

    it("should display error when forms submit with no name", () => {
        const wrapper = shallow(<EditLabel {...props} />);
        wrapper.setState({ ...state, labelName: "" });
        const e = {
            preventDefault: jest.fn()
        };
        wrapper.instance().handleSubmit(e);
        expect(wrapper.state()).toEqual({ ...state, labelName: "", errorName: "Please enter a label name" });
    });

    it("should display error when forms submit with no color", () => {
        const wrapper = shallow(<EditLabel {...props} />);
        wrapper.setState({ ...state, color: "" });
        const e = {
            preventDefault: jest.fn()
        };
        wrapper.instance().handleSubmit(e);
        expect(wrapper.state()).toEqual({ ...state, color: "", errorColor: "Please select a color" });
    });

    it("should return onHide() in props", () => {
        const wrapper = shallow(<EditLabel {...props} />);
        wrapper.find(Modal).props().onHide();
        expect(props.onHide).toHaveBeenCalled();
    });
});

describe("mapDispatchToProps()", () => {
    let dispatch;
    let props;

    beforeEach(() => {
        dispatch = jest.fn();
        props = mapDispatchToProps(dispatch);
    });

    it("should return onSubmit in props", () => {
        const labelId = "1";
        const name = "FooBar";
        const description = "BarFoo";
        const color = "#000000";
        props.onSubmit(labelId, name, description, color);
        expect(dispatch).toHaveBeenCalledWith({
            type: "UPDATE_LABEL_REQUESTED",
            labelId,
            name,
            description,
            color
        });
    });

    it("should return onHide in props", () => {
        props.onHide();
        expect(dispatch).toHaveBeenCalledWith({
            type: PUSH_STATE,
            state: {
                editLabel: false
            }
        });
    });
});
