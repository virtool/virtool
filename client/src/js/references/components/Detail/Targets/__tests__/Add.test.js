import { AddTarget, mapStateToProps, mapDispatchToProps } from "../Add";
import { TargetForm } from "../Form";

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
            show: true,
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

    it("should render required when form onClick() prop is called", () => {
        const wrapper = shallow(<AddTarget {...props} />);
        wrapper.find(TargetForm).prop("onClick")();
        expect(wrapper).toMatchSnapshot();
    });

    it("should render error when submitted without name", () => {
        const wrapper = shallow(<AddTarget {...props} />);
        wrapper.find("form").simulate("submit", e);
        expect(e.preventDefault).toHaveBeenCalledWith();
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onSubmit() and onHide() when submitted", () => {
        const wrapper = shallow(<AddTarget {...props} />);
        wrapper.setState({
            name: "Foo",
            description: "Foo description",
            length: 10,
            required: true
        });
        wrapper.find("form").simulate("submit", e);
        expect(e.preventDefault).toHaveBeenCalledWith();
        expect(props.onSubmit).toHaveBeenCalledWith("baz", {
            targets: [
                {
                    description: "bar",
                    length: 1,
                    name: "foo",
                    required: true
                },
                {
                    description: "Foo description",
                    length: 10,
                    name: "Foo",
                    required: true
                }
            ]
        });
        expect(props.onHide).toHaveBeenCalledWith();
    });

    it("should reset state when closed", () => {
        const wrapper = shallow(<AddTarget {...props} />);
        wrapper.setState({
            name: "Foo",
            description: "Foo description",
            length: 10,
            required: true
        });
        wrapper.setProps({ show: false });
        setTimeout(() => expect(wrapper.state()).toEqual({ ...state }), 500);
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
    it("should return onSubmit() in props", () => {
        const dispatch = jest.fn();
        const props = mapDispatchToProps(dispatch);
        props.onSubmit("foo", "bar");
        expect(dispatch).toHaveBeenCalledWith({ refId: "foo", update: "bar", type: "EDIT_REFERENCE_REQUESTED" });
    });
});
