import { CHANGE_ACCOUNT_PASSWORD, CLEAR_ERROR } from "../../../app/actionTypes";
import { ChangePassword, mapStateToProps, mapDispatchToProps } from "../Password";

describe("<ChangePassword />", () => {
    let props;

    beforeEach(() => {
        props = {
            error: null,
            lastPasswordChange: "2018-02-14T12:00:00.000000Z",
            minimumLength: 8,
            ready: true,
            onChangePassword: jest.fn(),
            onClearError: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<ChangePassword {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with error", () => {
        props.error = {
            status: 400,
            message: "existing error"
        };
        const wrapper = shallow(<ChangePassword {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render placeholder when [props.ready=false]", () => {
        props.ready = false;
        const wrapper = shallow(<ChangePassword {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onClearError() input changes and there is a pre-existing error", () => {
        props.error = {
            status: 422,
            message: "existing error"
        };
        const wrapper = shallow(<ChangePassword {...props} />);
        const e = {
            target: {
                name: "newPassword",
                value: "foobar"
            }
        };
        wrapper
            .find("InputError")
            .at(1)
            .simulate("change", e);
        expect(props.onClearError).toHaveBeenCalled();
    });

    describe("handleSubmit()", () => {
        let expectedState;

        beforeEach(() => {
            expectedState = {
                oldPassword: "",
                newPassword: "foobar123",
                confirmPassword: "foobar123",
                error: null,
                errorConfirmPassword: "",
                errorNewPassword: "Passwords must contain at least 8 characters",
                errorOldPassword: "Please provide your old password"
            };
        });

        it("should call onSubmit when input values are valid", () => {
            const wrapper = shallow(<ChangePassword {...props} />);
            wrapper.setState({
                oldPassword: "hello1world2",
                newPassword: "foobar123",
                confirmPassword: "foobar123"
            });
            const e = {
                preventDefault: jest.fn()
            };
            wrapper.find("form").simulate("submit", e);
            expect(e.preventDefault).toHaveBeenCalled();
            expect(wrapper.state()).toEqual({
                ...expectedState,
                errorNewPassword: "",
                errorOldPassword: "",
                oldPassword: "hello1world2"
            });
            expect(props.onChangePassword).toHaveBeenCalledWith("hello1world2", "foobar123");
        });

        it("should set error if old password field is empty", () => {
            const wrapper = shallow(<ChangePassword {...props} />);
            wrapper.setState({
                newPassword: "foobar123",
                confirmPassword: "foobar123"
            });
            const e = {
                preventDefault: jest.fn()
            };
            wrapper.find("form").simulate("submit", e);
            expect(e.preventDefault).toHaveBeenCalled();
            expect(wrapper.state()).toEqual({
                ...expectedState,
                errorNewPassword: ""
            });
        });

        it("should set error if new passwords don't match", () => {
            const wrapper = shallow(<ChangePassword {...props} />);
            wrapper.setState({
                oldPassword: "hello1world2",
                newPassword: "foobar124",
                confirmPassword: "foobar123"
            });
            const e = {
                preventDefault: jest.fn()
            };
            wrapper.find("form").simulate("submit", e);
            expect(e.preventDefault).toHaveBeenCalled();
            expect(wrapper.state()).toEqual({
                ...expectedState,
                newPassword: "foobar124",
                oldPassword: "hello1world2",
                errorConfirmPassword: "New passwords do not match",
                errorNewPassword: "",
                errorOldPassword: ""
            });
        });

        it("should set error if new passwords are too short", () => {
            const wrapper = shallow(<ChangePassword {...props} />);
            wrapper.setState({
                oldPassword: "hello1world2",
                newPassword: "foobar",
                confirmPassword: "foobar"
            });
            const e = {
                preventDefault: jest.fn()
            };
            wrapper.find("form").simulate("submit", e);
            expect(e.preventDefault).toHaveBeenCalled();
            expect(wrapper.state()).toEqual({
                ...expectedState,
                newPassword: "foobar",
                confirmPassword: "foobar",
                oldPassword: "hello1world2",
                errorConfirmPassword: "",
                errorNewPassword: "Passwords must contain at least 8 characters",
                errorOldPassword: ""
            });
        });
    });
});

describe("mapStateToProps()", () => {
    const expected = {
        lastPasswordChange: "2018-02-14T12:00:00.000000Z",
        minimumLength: 12,
        error: "Passwords do not match",
        ready: true
    };

    let state;

    beforeEach(() => {
        state = {
            account: {
                last_password_change: "2018-02-14T12:00:00.000000Z"
            },
            settings: {
                data: {
                    minimum_password_length: 12
                }
            },
            errors: {
                CHANGE_ACCOUNT_PASSWORD_ERROR: "Passwords do not match"
            }
        };
    });

    it("should return props with error", () => {
        const props = mapStateToProps(state);
        expect(props).toEqual({ ...expected });
    });

    it("should return props with no error", () => {
        state.errors = {};
        const props = mapStateToProps(state);
        expect(props).toEqual({ ...expected, error: "" });
    });

    it("should return props when settings unavailable", () => {
        state.settings.data = null;
        const props = mapStateToProps(state);
        expect(props).toEqual({ ...expected, ready: false, minimumLength: undefined });
    });
});

describe("mapDispatchToProps()", () => {
    let dispatch;
    let props;

    beforeEach(() => {
        dispatch = jest.fn();
        props = mapDispatchToProps(dispatch);
    });

    it("should return onChangePassword() in props", () => {
        const oldPassword = "foo";
        const newPassword = "bar";
        props.onChangePassword(oldPassword, newPassword);
        expect(dispatch).toHaveBeenCalledWith({
            type: CHANGE_ACCOUNT_PASSWORD.REQUESTED,
            oldPassword,
            newPassword
        });
    });

    it("should return onClearError() in props", () => {
        props.onClearError();
        expect(dispatch).toHaveBeenCalledWith({
            type: CLEAR_ERROR,
            error: "CHANGE_ACCOUNT_PASSWORD_ERROR"
        });
    });
});
