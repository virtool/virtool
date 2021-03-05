import { Input, PasswordInput, WallDialogFooter } from "../../base";
import { FirstUser, mapDispatchToProps } from "../FirstUser";
import { waitFor, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

        expect(wrapper).toMatchSnapshot();
    });

    it.each(["username", "password"])("should render when %p changed", name => {
        const value = name === "username" ? "bob" : "password";

        //const wrapper = shallow(<FirstUser {...props} />);
        const { asFragment } = renderWithProviders(<FirstUser {...props} />);
        //const firstRender = asFragment();

        userEvent.type(screen.getByRole("textbox", name), value);

        //console.log("********************The input contains: ", screen.getByRole("textbox", name).value);

        expect(screen.getByRole("textbox", name).value).toBe(value);
    });

    // EVERYTHING BELOW IS FUNCTIONAL!!!

    it("should call onSubmit when form is submitted", async () => {
        props = {
            onSubmit: jest.fn(),
            ...errorMessages
        };
        const usernameInput = "Username";
        const passwordInput = "Password";

        renderWithProviders(<FirstUser {...props} />);

        userEvent.type(screen.getByRole("textbox", /username/i), usernameInput);
        userEvent.type(screen.getByRole("textbox", /password/i), passwordInput);
        userEvent.click(screen.getByRole("button", { name: /Create User/i }));

        // Await must be used to allow the Formik component to call onSubmit asynchronously
        await waitFor(() =>
            expect(props.onSubmit).toHaveBeenCalledWith(usernameInput + passwordInput, expect.anything())
        );
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
