import { AddTarget, mapStateToProps, mapDispatchToProps } from "../Add";

describe("<AddTarget />", () => {
    let props;
    let state;
    let e;
    beforeEach(() => {
        e = {
            preventDefault: jest.fn()
        };

        props = {
            targets: [{ name: "foo", description: "bar", length: 1, required: true }],
            onSubmit: jest.fn(),
            refId: "baz",
            onHide: jest.fn(),
            show: false,
            handleChange: jest.fn()
        };

        state = {
            name: "",
            description: "",
            length: 0,
            required: false,
            errorName: ""
        };
    });

    it("should render", () => {
        const wrapper = shallow(<AddTarget {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("handleSubmit() should change errorName when [this.state.name=null]", () => {
        const wrapper = shallow(<AddTarget {...props} />);
        wrapper.find("form").simulate("submit", e);
        expect(wrapper.state().errorName).toBe("Required Field");
    });

    it("handleSubmit() should change call this.props.onSubmit when this.state.name exists", () => {
        const wrapper = shallow(<AddTarget {...props} />);
        wrapper.setState({ ...state, name: "Foo" });

        const update = {
            targets: [
                ...props.targets,
                {
                    name: "Foo",
                    description: "",
                    length: new Number(0),
                    required: false
                }
            ]
        };

        wrapper.find("form").simulate("submit", e);
        expect(props.onSubmit).toHaveBeenCalledWith("baz", update);
    });

    it("handleSubmit() should call onHide()", () => {
        const wrapper = shallow(<AddTarget {...props} />);
        wrapper.find("form").simulate("submit", e);
        expect(props.onHide).toHaveBeenCalled();
    });

    it("handleChange() should change state.name", () => {
        e.target = {
            name: "name",
            value: "Foo"
        };
        const wrapper = shallow(<AddTarget {...props} />);
        wrapper.find("TargetForm").simulate("change", e);
        expect(wrapper.state().name).toEqual("Foo");
    });

    it("handleClick() should change state.required", () => {
        const wrapper = shallow(<AddTarget {...props} />);
        wrapper.find("TargetForm").simulate("click");
        expect(wrapper.state().required).toEqual(true);
    });

    it("handleExited() should call set to initial state", () => {
        const wrapper = shallow(<AddTarget {...props} />);
        wrapper.find("ModalDialog").simulate("exit");
        expect(wrapper.state()).toEqual({ ...state });
    });
});

describe("mapStateToProps()", () => {
    it("should return props", () => {
        const state = {
            references: {
                documents: "baz",
                detail: {
                    name: "foo",
                    data_type: "bar",

                    id: "boo",
                    targets: [{ Foo: "Bar" }]
                }
            }
        };
        const result = mapStateToProps(state);
        expect(result).toEqual({
            names: "foo",
            dataType: "bar",
            documents: "baz",
            refId: "boo",
            targets: [{ Foo: "Bar" }]
        });
    });
});

describe("mapDispatchToProps()", () => {
    it("should return onSubmit in props ", () => {
        const dispatch = jest.fn();
        const props = mapDispatchToProps(dispatch);
        props.onSubmit("foo", "bar");
        expect(dispatch).toHaveBeenCalledWith({ refId: "foo", update: "bar", type: "EDIT_REFERENCE_REQUESTED" });
    });
});
