import { EmptyReference, mapDispatchToProps } from "../Empty";

describe("<EmptyReference />", () => {
    const props = {
        onSubmit: jest.fn()
    };

    let state;

    const e = {
        preventDefault: jest.fn(),
        target: {
            name: "name",
            value: "foo",
            error: "error"
        }
    };

    beforeEach(() => {
        state = {
            name: "",
            description: "",
            dataType: "genome",
            organism: "",
            errorName: "",
            errorDataType: "",
            mode: "empty"
        };
    });

    it("should render", () => {
        const wrapper = shallow(<EmptyReference {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("handleChange should update name and error", () => {
        const wrapper = shallow(<EmptyReference {...props} />);
        wrapper.find("ReferenceForm").simulate("change", e);
        expect(wrapper.state()).toEqual({
            ...state,
            name: "foo"
        });
    });

    it("handleSubmit() should update errorName in state when [this.state.name.length = 0]", () => {
        const wrapper = shallow(<EmptyReference {...props} />);
        wrapper.find("form").simulate("submit", e);
        wrapper.setState({ errorDataType: "foo" });
        expect(wrapper.state()).toEqual({
            ...state,
            errorDataType: "foo",
            errorName: "Required Field"
        });
    });

    it("handleSubmit() should update errorName in state when [this.state.dataType.length = 0]", () => {
        const wrapper = shallow(<EmptyReference {...props} />);
        wrapper.setState({
            ...state,
            name: "foo",
            dataType: ""
        });
        wrapper.find("form").simulate("submit", e);
        expect(wrapper.state()).toEqual({
            ...state,
            name: "foo",
            dataType: "",
            errorDataType: "Required Field"
        });
    });
    it("handleSubmit should call this.props.onSubmit when [this.state.name.length!=0] and [this.state.dataType.length!=0]", () => {
        const wrapper = shallow(<EmptyReference {...props} />);
        wrapper.setState({
            ...state,
            name: "foo",
            description: "bar",
            organism: "baz"
        });
        wrapper.find("form").simulate("submit", e);
        expect(props.onSubmit).toHaveBeenCalledWith("foo", "bar", "genome", "baz");
    });
});

describe("mapDispatchToProps()", () => {
    const dispatch = jest.fn();
    const props = mapDispatchToProps(dispatch);
    it("should return onSubmit in props", () => {
        props.onSubmit("foo", "bar", "fee", "baz");
        expect(dispatch).toHaveBeenCalledWith({
            name: "foo",
            description: "bar",
            dataType: "fee",
            organism: "baz",
            type: "EMPTY_REFERENCE_REQUESTED"
        });
    });
    it("should return onClearError in props", () => {
        props.onClearError("foo");
        expect(dispatch).toHaveBeenCalledWith({
            error: "foo",
            type: "CLEAR_ERROR"
        });
    });
});
