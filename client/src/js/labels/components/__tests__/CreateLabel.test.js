import { Create, mapDispatchToProps } from "../Create";
import { Modal } from "../../../base";
import { PUSH_STATE } from "../../../app/actionTypes";

describe("<Create>", () => {
    let props, state;
    beforeEach(() => {
        props = {
            show: false,
            onHide: jest.fn(),
            onSubmit: jest.fn()
        };
        state = {
            labelName: "FooBar",
            color: "#FFF000",
            description: "FooDesc",
            errorName: "",
            errorColor: ""
        };
    });

    it("should render when [show=false]", () => {
        const wrapper = shallow(<Create {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [show=true]", () => {
        props.show = true;
        const wrapper = shallow(<Create {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should return onSubmit() in props", () => {
        const wrapper = shallow(<Create {...props} />);
        wrapper.setState({ ...state });
        const e = {
            preventDefault: jest.fn()
        };
        wrapper.instance().handleSubmit(e);
        expect(props.onSubmit).toHaveBeenCalledWith("FooBar", "FooDesc", "#FFF000");
    });

    it("should submit onSubmit() with no description", () => {
        const wrapper = shallow(<Create {...props} />);
        wrapper.setState({ ...state, description: "" });
        const e = {
            preventDefault: jest.fn()
        };
        wrapper.instance().handleSubmit(e);
        expect(props.onSubmit).toHaveBeenCalledWith("FooBar", "", "#FFF000");
    });

    it("should display error when forms submit with no name", () => {
        const wrapper = shallow(<Create {...props} />);
        wrapper.setState({ ...state, labelName: "" });
        const e = {
            preventDefault: jest.fn()
        };
        wrapper.instance().handleSubmit(e);
        expect(wrapper.state()).toEqual({ ...state, labelName: "", errorName: "Please enter a label name" });
    });

    it("should display error when forms submit with no color", () => {
        const wrapper = shallow(<Create {...props} />);
        wrapper.setState({ ...state, color: "" });
        const e = {
            preventDefault: jest.fn()
        };
        wrapper.instance().handleSubmit(e);
        expect(wrapper.state()).toEqual({ ...state, color: "", errorColor: "Please select a color" });
    });

    it("should call onHide() when Create.onHide() is called", () => {
        const wrapper = shallow(<Create {...props} />);
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
        const name = "FooBar";
        const description = "BarFoo";
        const color = "#000000";
        props.onSubmit(name, description, color);
        expect(dispatch).toHaveBeenCalledWith({
            type: "CREATE_LABEL_REQUESTED",
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
                createLabel: false
            }
        });
    });
});
