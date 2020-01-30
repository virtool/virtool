import { EditSubtraction, mapDispatchToProps } from "../Edit";
describe("<EditSubtraction />", () => {
    const e = {
        preventDefault: jest.fn(),
        target: {
            value: "Foo"
        }
    };

    const props = {
        entry: {
            id: "foo",
            file: { name: "bar" },
            nickname: "baz"
        },
        onUpdate: jest.fn(),
        show: true,
        exited: jest.fn()
    };

    const state = {
        subtractionId: "foo",
        nickname: "baz",
        fileId: "bar"
    };

    it("should render", () => {
        const wrapper = shallow(<EditSubtraction {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call handleSubmit() when form is submitted", () => {
        const wrapper = shallow(<EditSubtraction {...props} />);
        wrapper.find("form").simulate("submit", e);
        expect(props.onUpdate).toHaveBeenCalledWith("foo", "baz");
        expect(props.exited).toHaveBeenCalled();
    });

    it("should change nickname when InputError is changed", () => {
        const wrapper = shallow(<EditSubtraction {...props} />);
        wrapper
            .find("InputError")
            .at(1)
            .simulate("change", e);
        expect(wrapper.state()).toEqual({
            ...state,
            nickname: "Foo"
        });
    });
});

describe("mapDispatchToProps()", () => {
    it("should return updateSubtraction in props", () => {
        const dispatch = jest.fn();
        const props = mapDispatchToProps(dispatch);
        props.onUpdate("foo", "bar");
        expect(dispatch).toHaveBeenCalledWith({
            subtractionId: "foo",
            nickname: "bar",
            type: "UPDATE_SUBTRACTION_REQUESTED"
        });
    });
});
