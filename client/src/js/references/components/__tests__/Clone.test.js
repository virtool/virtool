import { CloneReference, mapDispatchToProps, mapStateToProps } from "../Clone";
import { ReferenceSelector } from "../ReferenceSelector";

describe("<CloneReference />", () => {
    const props = {
        refId: "foo",
        refDocuments: [{ foo: "bar" }],
        onSubmit: jest.fn()
    };

    let state;
    let e;

    beforeEach(() => {
        state = {
            reference: "",
            name: "",
            description: "",
            dataType: "genome",
            organism: "",
            errorName: "",
            errorDataType: "",
            errorSelect: "",
            mode: "clone"
        };
        e = {
            preventDefault: jest.fn(),
            target: {
                name: "foo",
                value: "bar",
                error: false
            }
        };
    });

    it("should render", () => {
        const wrapper = shallow(<CloneReference {...props} />);
        expect(wrapper.state()).toMatchSnapshot();
    });

    it("handleChange() should return setState() when [name===name]", () => {
        e.target = {
            name: "name",
            value: "foo",
            error: "error"
        };
        const wrapper = shallow(<CloneReference {...props} />);
        wrapper.find("ReferenceForm").simulate("change", e);
        expect(wrapper.state()).toEqual({
            ...state,
            reference: "foo",
            name: "foo"
        });
    });
    it("handleChange() should return setState() when [name===reference]", () => {
        e.target = {
            name: "reference",
            value: "bar",
            error: "error"
        };
        const wrapper = shallow(<CloneReference {...props} />);
        wrapper.find("ReferenceForm").simulate("change", e);
        expect(wrapper.state()).toEqual({
            ...state,
            reference: "bar",
            errorSelect: ""
        });
    });
    it("handleChange() should return setState() when [name!=reference] and [name!=name]", () => {
        e.target = {
            name: "foo",
            value: "bar",
            error: "baz"
        };
        const wrapper = shallow(<CloneReference {...props} />);
        wrapper.find("ReferenceForm").simulate("change", e);
        expect(wrapper.state()).toEqual({
            ...state,
            reference: "foo",
            foo: "bar"
        });
    });

    it("should call handleSelect() when ReferenceSelector is selected", () => {
        const wrapper = shallow(<CloneReference {...props} />);
        wrapper.find(ReferenceSelector).simulate("select");
        expect(wrapper.state()).toEqual({
            ...state,
            reference: undefined
        });
    });

    it("handleSubmit() should return errorName when [this.state.name.length=0]", () => {
        const wrapper = shallow(<CloneReference {...props} />);
        wrapper.setState({
            ...state,
            name: []
        });
        wrapper.find("form").simulate("submit", e);
        expect(wrapper.state()).toEqual({
            ...state,
            name: [],
            errorName: "Required Field"
        });
    });
    it("handleSubmit() should return errorName when [this.state.dataType.length=0]", () => {
        const wrapper = shallow(<CloneReference {...props} />);
        wrapper.setState({
            ...state,
            name: [{ foo: "bar" }],
            dataType: []
        });
        wrapper.find("form").simulate("submit", e);
        expect(wrapper.state()).toEqual({
            ...state,
            name: [{ foo: "bar" }],
            dataType: [],
            errorDataType: "Required Field"
        });
    });
    it("handleSubmit() should return errorName when [!!this.state.reference]", () => {
        const wrapper = shallow(<CloneReference {...props} />);
        wrapper.setState({
            ...state,
            name: [{ foo: "bar" }],
            dataType: [{ foo: "bar" }],
            reference: ""
        });
        wrapper.find("form").simulate("submit", e);
        expect(wrapper.state()).toEqual({
            ...state,
            name: [{ foo: "bar" }],
            dataType: [{ foo: "bar" }],
            reference: "",
            errorSelect: "Please select a source reference"
        });
    });
});

describe("mapStateToProps()", () => {
    it("should return props", () => {
        const state = {
            router: {
                location: {
                    state: {
                        id: "foo"
                    }
                }
            },
            references: { documents: "bar" }
        };
        const result = mapStateToProps(state);
        expect(result).toEqual({
            refId: "foo",
            refDocuments: "bar"
        });
    });
});

describe("mapDispatchToProps()", () => {
    const dispatch = jest.fn();
    const props = mapDispatchToProps(dispatch);

    it("should return onSubmit in props", () => {
        props.onSubmit("foo", "bar", "fee", "baz", "boo");
        expect(dispatch).toHaveBeenCalledWith({
            name: "foo",
            description: "bar",
            dataType: "fee",
            organism: "baz",
            refId: "boo",
            type: "CLONE_REFERENCE_REQUESTED"
        });
    });
    it("should return onClearError in props", () => {
        props.onClearError(true);
        expect(dispatch).toHaveBeenCalledWith({ error: true, type: "CLEAR_ERROR" });
    });
});
