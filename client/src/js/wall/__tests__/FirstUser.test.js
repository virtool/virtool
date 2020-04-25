import { Input, PasswordInput } from "../../base";
import { FirstUser, mapDispatchToProps } from "../FirstUser";

describe("<FirstUser />", () => {
    let props;

    beforeEach(() => {
        props = {
            onSubmit: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<FirstUser {...props} />);
        wrapper.setState({
            username: "bob",
            password: "password"
        });
        expect(wrapper).toMatchSnapshot();
    });

    it.each(["username", "password"])("should render when %p changed", name => {
        const e = {
            target: {
                name,
                value: name === "username" ? "bob" : "password"
            }
        };

        const wrapper = shallow(<FirstUser {...props} />);

        wrapper.find(name === "username" ? Input : PasswordInput).simulate("change", e);

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
