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

    it("should call onChange username changes", () => {
        const e = {
            target: {
                name: "username",
                value: "bar"
            }
        };
        const wrapper = shallow(<FirstUser {...props} />);
        wrapper
            .find("Input")
            .at(0)
            .prop("onChange")(e);

        expect(wrapper.state()).toEqual({
            username: "bar",
            password: ""
        });
    });

    it("should call onChange when password changes", () => {
        const e = {
            target: {
                name: "password",
                value: "foo"
            }
        };
        const wrapper = shallow(<FirstUser {...props} />);
        wrapper
            .find("Input")
            .at(1)
            .prop("onChange")(e);

        expect(wrapper.state()).toEqual({
            username: "",
            password: "foo"
        });
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
