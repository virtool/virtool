jest.mock("connected-react-router");

import * as actions from "../../actions";
import CreateUserContainer, { CreateUser, mapStateToProps, mapDispatchToProps } from "../Create";
import { push } from "connected-react-router";

describe("<CreateUser />", () => {
    let props;
    let state;
    let hasError;

    beforeEach(() => {
        props = {
            error: "foo",
            onClearError: jest.fn(),
            onCreate: jest.fn()
        };

        state = {
            confirm: "",
            errorConfirm: "",
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

    it("should call handleChange when InputError is changed", () => {
        let name, value, error;

        const e = {
            target: { name: "name", value: "foo" }
        };
        const wrapper = shallow(<CreateUser {...props} />);
        wrapper
            .find("InputError")
            .at(0)
            .simulate("change", e);

        expect(wrapper.state()).toEqual({
            ...state,
            name: "foo",
            errorName: ""
        });

        expect(props.onClearError).toHaveBeenCalledWith("CREATE_USER_ERROR");
    });

    it("should call handleModalExited when modal is exited", () => {
        const wrapper = shallow(<CreateUser {...props} />);
        wrapper
            .find("Modal")
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

    it("should call handleSubmit when form is submitted and [this.state.confirm !== this.state.password]", () => {
        const e = {
            preventDefault: jest.fn()
        };
        const wrapper = shallow(<CreateUser {...props} />);
        wrapper.setState({ userId: "foo", password: "foo", confirm: "bar" });
        wrapper.find("form").simulate("submit", e);
        expect(wrapper.state()).toEqual({
            ...state,
            userId: "foo",
            password: "foo",
            confirm: "bar",
            errorConfirm: "Passwords do not match"
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
        push.mockReturnValue({
            type: "PUSH"
        });

        result.onHide({ ...window.location, state: { createUser: false } });

        expect(dispatch).toHaveBeenCalledWith({ type: "PUSH" });
    });

    it("should return onClearError() in props", () => {
        const error = true;
        const onClearError = jest.fn();
        result.onClearError(error);
        expect(dispatch).toHaveBeenCalledWith({
            error: true,
            type: "CLEAR_ERROR"
        });
    });
});
