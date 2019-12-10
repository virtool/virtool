import { CreateReference, mapDispatchToProps } from "../Create";

describe("<CreateReference />", () => {
    const e = {
        preventDefault: jest.fn(),
        target: {
            name: "name",
            value: "foo",
            error: "error"
        }
    };
    const props = {
        onSubmit: jest.fn()
    };
    let state;
    beforeEach(() => {
        state = {
            name: [{ foo: "bar" }],
            dataType: [{ foo: "bar" }],
            description: "foo",
            organism: "bar",
            dataType: [{ foo: "bar" }],
            errorDataType: "",
            errorName: "",
            mode: "foo"
        };
    });

    it("should call handleChange() when ReferenceForm is changed", () => {
        const wrapper = shallow(<CreateReference {...props} />);
        wrapper.setState({
            ...state
        });
        wrapper.find("ReferenceForm").simulate("change", e);
        expect(wrapper.state()).toEqual({
            ...state,
            name: "foo"
        });
    });

    it("handleSubmit() should return errorName when [this.state.name.length = 0]", () => {
        const wrapper = shallow(<CreateReference {...props} />);
        wrapper.setState({
            ...state,
            name: []
        });

        wrapper.find("form").simulate("submit", e);
        expect(wrapper.state()).toEqual({
            ...state,
            errorName: "Required Field",
            name: []
        });
    });

    it("handleSubmit() should return errorName when [this.state.dataType.length = 0]", () => {
        const wrapper = shallow(<CreateReference {...props} />);
        wrapper.setState({
            ...state,
            dataType: []
        });
        wrapper.find("form").simulate("submit", e);
        expect(wrapper.state()).toEqual({
            ...state,
            dataType: [],
            errorDataType: "Required Field"
        });
    });

    it("handleSubmit() should return onSubmit when [this.state.name.length!=0] and [this.state.dataType.length!=0]", () => {
        const wrapper = shallow(<CreateReference {...props} />);
        wrapper.setState({
            ...state
        });
        wrapper.find("form").simulate("submit", e);
        expect(props.onSubmit).toHaveBeenCalledWith([{ foo: "bar" }], "foo", [{ foo: "bar" }], "bar");
    });
});

describe("mapDispatchToProps()", () => {
    const dispatch = jest.fn();
    const props = mapDispatchToProps(dispatch);
    it("should return onSubmit() in props", () => {
        props.onSubmit("foo", "bar", "fee", "baz");
        expect(dispatch).toHaveBeenCalledWith({
            name: "foo",
            description: "bar",
            dataType: "fee",
            organism: "baz",
            type: "CREATE_REFERENCE_REQUESTED"
        });
    });

    it("should return onClearError() in props", () => {
        props.onClearError("foo");
        expect(dispatch).toHaveBeenCalledWith({ error: "foo", type: "CLEAR_ERROR" });
    });
});
