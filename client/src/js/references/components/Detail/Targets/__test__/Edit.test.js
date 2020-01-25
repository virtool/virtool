import { EditTarget, mapStateToProps, mapDispatchToProps } from "../Edit";

describe("<EditTarget />", () => {
    let props;
    let state;
    let e;

    beforeEach(() => {
        e = {
            preventDefault: jest.fn()
        };
        props = {
            initialName: "",
            initialDescription: "",
            initialLength: 0,
            refId: "",
            initialRequired: false,
            onSubmit: jest.fn(),
            onHide: jest.fn(),

            targets: [
                {
                    name: "",
                    description: "",
                    length: 0,
                    required: ""
                }
            ]
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
        const wrapper = shallow(<EditTarget {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("handleSubmit() should call onSubmit() when this.state.name exists", () => {
        const wrapper = shallow(<EditTarget {...props} />);
        wrapper.setState({
            name: "Foo",
            description: "Bar",
            length: 2,
            required: true,
            errorName: ""
        });
        const length = new Number(2);

        wrapper.find("form").simulate("submit", e);
        expect(props.onSubmit).toHaveBeenCalledWith("", {
            targets: [
                {
                    name: "Foo",
                    description: "Bar",
                    length,
                    required: true
                }
            ]
        });
    });

    it("handleSubmit() should not call onSubmit but call onHide this.state.name===null", () => {
        const wrapper = shallow(<EditTarget {...props} />);
        wrapper.setState({
            name: null,
            description: "Bar",
            length: 2,
            required: true,
            errorName: ""
        });
        wrapper.find("form").simulate("submit", e);
        expect(props.onSubmit).not.toHaveBeenCalled();
        expect(props.onHide).toHaveBeenCalled();
    });

    it("handleChange() should update state", () => {
        e.target = {
            name: "name",
            value: "Foo",
            checked: true
        };
        const wrapper = shallow(<EditTarget {...props} />);
        wrapper.find("TargetForm").simulate("change", e);
        expect(wrapper.state()).toEqual({ ...state, name: "Foo", required: true });
    });

    it("handleEnter() should set initial state", () => {
        props = {
            initialName: "Foo",
            initialDescription: "Bar",
            initialLength: 1,
            initialRequired: true
        };
        const wrapper = shallow(<EditTarget {...props} />);
        wrapper.find("Modal").simulate("enter");
        expect(wrapper.state()).toEqual({ ...state, name: "Foo", description: "Bar", length: 1, required: true });
    });
});

describe("mapStateToProps()", () => {
    let ownProps;
    let state;

    beforeEach(() => {
        ownProps = {
            activeName: "foo"
        };
        state = {
            references: {
                detail: {
                    id: "baz",
                    targets: [
                        { name: "foo", description: "bar", length: 1, required: false },
                        { name: "Foo", description: "Bar", length: 2, required: true }
                    ]
                }
            }
        };
    });

    it("should return props when {name: ownProps.activeName} is found in initialTarget", () => {
        const result = mapStateToProps(state, ownProps);
        expect(result).toEqual({
            initialTarget: { name: "foo", description: "bar", length: 1, required: false },
            targets: [
                { name: "foo", description: "bar", length: 1, required: false },
                { name: "Foo", description: "Bar", length: 2, required: true }
            ],
            initialName: "foo",
            initialDescription: "bar",
            initialLength: 1,
            initialRequired: false,
            refId: "baz"
        });
    });

    it("should return props when {name: ownProps.activeName} is not found in initialTarget", () => {
        ownProps.activeName = "fee";
        const result = mapStateToProps(state, ownProps);

        expect(result).toEqual({
            initialTarget: {},
            targets: [
                { name: "foo", description: "bar", length: 1, required: false },
                { name: "Foo", description: "Bar", length: 2, required: true }
            ],
            initialName: undefined,
            initialDescription: undefined,
            initialLength: undefined,
            initialRequired: undefined,
            refId: "baz"
        });
    });
});

describe("mapDispatchToProps()", () => {
    it("should return onSubmit in props", () => {
        const dispatch = jest.fn();
        const props = mapDispatchToProps(dispatch);
        props.onSubmit("foo", "bar");
        expect(dispatch).toHaveBeenCalledWith({
            refId: "foo",
            update: "bar",
            type: "EDIT_REFERENCE_REQUESTED"
        });
    });
});
