import { Input, PasswordInput } from "../../base";
import { FirstUser, mapDispatchToProps } from "../FirstUser";
import { waitFor, fireEvent, screen } from "@testing-library/react";

describe("<FirstUser />", () => {
    let props;
    let errorMessages;

    beforeEach(() => {
        errorMessages = {
            generalError: "General Error",
            usernameErrors: ["Password Error 1", "Password Error 2"],
            passwordErrors: ["Username Error 1", "Username Error 2"]
        };
        props = {
            onSubmit: jest.fn(),
            ...errorMessages
        };
    });

    it("should render", () => {
        const wrapper = shallow(<FirstUser {...props} />);
        // wrapper.setState({
        //     username: "bob",
        //     password: "password"
        // });
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

    it("should call onSubmit when form is submitted", async () => {
        props = {
            onSubmit: jest.fn(),
            ...errorMessages
        };
        // const wrapper = shallow(<FirstUser {...props} />);
        const { container } = render(<FirstUser {...props} />);
        const submit = container.querySelector('button[type="submit"]');
        // wrapper.setState({
        //     username: "fee",
        //     password: "baz"
        // });
        const e = {
            preventDefault: jest.fn()
        };
        //wrapper.find("Formik").simulate("submit", e);

        // Await must be used to allow the Formik component to call it's own onSubmit
        await waitFor(() => {
            fireEvent.click(submit); //screen.getByRole("button", { name: "button-name" }));
        });
        expect(e.preventDefault).toHaveBeenCalled();
        expect(props.onSubmit).toHaveBeenCalledWith("", "");
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
