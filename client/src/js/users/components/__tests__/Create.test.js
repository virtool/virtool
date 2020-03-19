import { PUSH_STATE } from "../../../app/actionTypes";
import { Input, PasswordInput } from "../../../base";
import { CreateUser, mapDispatchToProps, mapStateToProps } from "../Create";

describe("<CreateUser />", () => {
    let props;
    let state;

    beforeEach(() => {
        props = {
            error: "foo",
            onClearError: jest.fn(),
            onCreate: jest.fn()
        };

        state = {
            errorPassword: "",
            errorUserId: "foo",
            forceReset: false,
            password: "",
            userId: ""
        };
    });

    it("should render", () => {
        const wrapper = shallow(<CreateUser {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when name has changed", () => {
        const e = {
            target: { name: "userId", value: "bob" }
        };
        const wrapper = shallow(<CreateUser {...props} />);
        expect(wrapper).toMatchSnapshot();
        wrapper.find(Input).simulate("change", e);
        expect(props.onClearError).toHaveBeenCalledWith("CREATE_USER_ERROR");
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when password has changed", () => {
        const e = {
            target: { name: "password", value: "password" }
        };
        const wrapper = shallow(<CreateUser {...props} />);
        expect(wrapper).toMatchSnapshot();
        wrapper.find(PasswordInput).simulate("change", e);
        expect(props.onClearError).toHaveBeenCalledWith("CREATE_USER_ERROR");
        expect(wrapper).toMatchSnapshot();
    });

    it("should call handleModalExited() when modal is closed", () => {
        const wrapper = shallow(<CreateUser {...props} />);
        wrapper
            .find("ModalDialog")
            .at(0)
            .simulate("exited");
        expect(props.onClearError).toHaveBeenCalledWith("CREATE_USER_ERROR");
    });

    it("should call handleToggleForceReset when Checkbox is clicked", () => {
        const wrapper = shallow(<CreateUser {...props} />);
        wrapper.find("Checkbox").simulate("click");
        expect(wrapper.state()).toEqual({ ...state, forceReset: true });
    });

    it("should call handleSubmit when form is submitted and [!this.state.userId=true]", () => {
        const e = {
            preventDefault: jest.fn()
        };
        const wrapper = shallow(<CreateUser {...props} />);
        wrapper.find("form").simulate("submit", e);
        expect(wrapper.state()).toEqual({ ...state, errorUserId: "Please specify a username" });
    });

    it("should call handleSubmit when form is submitted and [this.state.password.length < this.props.minimumPasswordLength]", () => {
        const e = {
            preventDefault: jest.fn()
        };
        props.minimumPasswordLength = 2;
        const wrapper = shallow(<CreateUser {...props} />);
        wrapper.setState({ userId: "foo", password: "f", confirm: "f" });
        wrapper.find("form").simulate("submit", e);
        expect(wrapper.state()).toEqual({
            ...state,
            userId: "foo",
            password: "f",
            confirm: "f",
            errorPassword: "Passwords must contain at least 2 characters"
        });
    });
});

describe("mapStateToProps", () => {
    it("should call mapStateToProps", () => {
        const state = {
            errors: {
                CREATE_USER_ERROR: {
                    message: "foo"
                }
            },
            router: { location: "foo" },
            users: {
                createPending: true
            },
            settings: {
                data: {
                    minimum_password_length: 1
                }
            }
        };

        const result = mapStateToProps(state);
        expect(result).toEqual({
            show: false,
            pending: true,
            minimumPasswordLength: 1,
            error: "foo"
        });
    });
});

describe("mapDispatchToProps", () => {
    let dispatch;
    let result;

    beforeEach(() => {
        dispatch = jest.fn();
        result = mapDispatchToProps(dispatch);
    });

    it("should return onCreate() in props", () => {
        const data = "foo";

        result.onCreate(data);
        expect(dispatch).toHaveBeenCalledWith({
            0: "f",
            1: "o",
            2: "o",
            type: "CREATE_USER_REQUESTED"
        });
    });
    it("should return onHide() in props", () => {
        result.onHide();
        expect(dispatch).toHaveBeenCalledWith({ type: PUSH_STATE, state: { createUser: false } });
    });

    it("should return onClearError() in props", () => {
        const error = true;
        result.onClearError(error);
        expect(dispatch).toHaveBeenCalledWith({
            error: true,
            type: "CLEAR_ERROR"
        });
    });
});
