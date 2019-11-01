import { FirstUser, mapDispatchToProps } from "../FirstUser";

describe("<FirstUser />", () => {
    let props;

    it("should render", () => {
        const wrapper = shallow(<FirstUser {...props} />);
        wrapper.setState({
            username: "foo",
            password: "bar"
        });
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onSubmit when form is submitted", () => {
        props = {
            onSubmit: jest.fn()
        };
        const wrapper = shallow(<FirstUser {...props} />);
        wrapper.setState({
            username: "fee",
            password: "baz"
        });
        const e = {
            preventDefault: jest.fn()
        };
        wrapper.find("form").simulate("submit", e);
        expect(e.preventDefault).toHaveBeenCalled();
        expect(props.onSubmit).toHaveBeenCalledWith("fee", "baz");
    });

    it.each([
        [
            0,
            {
                username: "bar",
                password: ""
            }
        ],
        [
            1,
            {
                username: "",
                password: "foo"
            }
        ]
    ])(".match(%o, %o)", (index, expected) => {
        const e = {
            target: {
                name: index === 0 ? "username" : "password",
                value: index === 0 ? "bar" : "foo"
            }
        };

        const wrapper = shallow(<FirstUser {...props} />);

        wrapper
            .find("Input")
            .at(index)
            .prop("onChange")(e);

        expect(wrapper.state()).toEqual(expected);
    });
});

describe("mapDispatchToProps", () => {
    it("should return onSubmit() on props", () => {
        const dispatch = jest.fn();
        const props = mapDispatchToProps(dispatch);

        props.onSubmit("foo", "bar");

        expect(dispatch).toHaveBeenCalledWith({
            userId: "foo",
            password: "bar",
            type: "CREATE_FIRST_USER_REQUESTED"
        });
    });
});
