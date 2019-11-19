import { Password, mapStateToProps, mapDispatchToProps } from "../Password";
import { editUser } from "../../actions";
describe("<Password />", () => {
    let props;
    let wrapper;
    let state;

    beforeEach(() => {
        props = {
            id: "bob",
            forceReset: false,
            lastPasswordChange: "2018-02-14T17:12:00.000000Z",
            minimumPasswordLength: 8,
            onSetForceReset: jest.fn(),
            onSubmit: jest.fn()
        };
        state = {
            password: "foo",
            confirm: "bar",
            errors: ["foo"],
            lastPasswordChange: "foo"
        };
    });
    it("renders correctly", () => {
        wrapper = shallow(<Password {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("componentWillUnmount should return getInitialState()", () => {
        const wrapper = shallow(<Password {...props} />);
        expect(wrapper.state()).toEqual({
            password: "",
            confirm: "",
            errors: [],
            lastPasswordChange: "2018-02-14T17:12:00.000000Z"
        });
    });

    it("should call handleChange when InputError is changed", () => {
        const e = {
            target: {
                name: "name",
                value: "bar"
            }
        };
        const wrapper = shallow(<Password {...props} />);
        wrapper
            .find("InputError")
            .at(0)
            .simulate("change", e);

        expect(wrapper.state()).toEqual({
            password: "",
            confirm: "",
            errors: [],
            lastPasswordChange: "2018-02-14T17:12:00.000000Z",
            name: "bar",
            errors: []
        });
    });

    it("should call handleClear when ButtonToolbar at(0) is clicked", () => {
        state.password = "foo";
        state.confirm = "bar";
        const wrapper = shallow(<Password {...props} />);
        wrapper
            .find("ButtonToolbar")
            .at(0)
            .simulate("click");

        expect(wrapper.state()).toEqual({
            password: "",
            confirm: "",
            errors: [],
            lastPasswordChange: "2018-02-14T17:12:00.000000Z",
            errors: []
        });
    });

    it("should call handleSetForceReset when Checkbox at(0) is clicked", () => {
        const wrapper = shallow(<Password {...props} />);
        wrapper
            .find("Checkbox")
            .at(0)
            .simulate("click");

        expect(props.onSetForceReset).toHaveBeenCalledWith("bob", true);
    });

    it("should call handleSubmit when form is submitted and !this.state.password=true", () => {
        const e = {
            preventDefault: jest.fn()
        };
        state.password = "";
        const wrapper = shallow(<Password {...props} />);
        wrapper
            .find("form")
            .at(0)
            .simulate("submit", e);

        expect(wrapper.state()).toEqual({
            confirm: "",
            errors: [{ id: 0, message: "Passwords must contain at least 8 characters" }],
            lastPasswordChange: "2018-02-14T17:12:00.000000Z",
            password: ""
        });
    });

    it("should call handleSubmit when form is submitted and this.state.confirm !== this.state.password", () => {
        const e = {
            preventDefault: jest.fn()
        };

        const wrapper = shallow(<Password {...props} />);
        wrapper.setState({
            password: "thisisthepassword"
        });
        wrapper
            .find("form")
            .at(0)
            .simulate("submit", e);

        expect(wrapper.state()).toEqual({
            confirm: "",
            errors: [{ id: 1, message: "Passwords do not match" }],
            lastPasswordChange: "2018-02-14T17:12:00.000000Z",
            password: "thisisthepassword"
        });
    });

    it("should call handleSubmit when form is submitted and errors.length=false", () => {
        const e = {
            preventDefault: jest.fn()
        };
        const wrapper = shallow(<Password {...props} />);
        wrapper.setState({
            password: "thisisthepassword",
            errors: "",
            confirm: "thisisthepassword"
        });
        wrapper
            .find("form")
            .at(0)
            .simulate("submit", e);

        expect(wrapper.state()).toEqual({
            confirm: "",
            lastPasswordChange: "2018-02-14T17:12:00.000000Z",
            password: "",
            errors: []
        });
    });
});

describe("mapStateToProps", () => {
    it("should return mapStateToProps", () => {
        let forceReset, id, lastPasswordChange, minimumPasswordLength;

        const state = {
            settings: {
                data: {
                    minimum_password_length: 2
                }
            },
            users: {
                detail: {
                    force_reset: true,
                    id: "foo",
                    last_password_change: "bar"
                }
            }
        };

        let result = (id, forceReset, lastPasswordChange, minimumPasswordLength);
        result = mapStateToProps(state);
        expect(result).toEqual({
            id: "foo",
            forceReset: true,
            lastPasswordChange: "bar",
            minimumPasswordLength: 2,
            error: ""
        });
    });
});

describe("mapDispatchToProps", () => {
    let dispatch;
    let props;
    beforeEach(() => {
        dispatch = jest.fn();
        props = mapDispatchToProps(dispatch);
    });

    it("should return onSubmit in props", () => {
        const userId = "foo";
        const password = { bar: "baz" };
        props.onSubmit(userId, password);
        expect(dispatch).toHaveBeenCalledWith(editUser(userId, { password }));
    });

    it("should return onSetForceReset in props", () => {
        const userId = "foo";
        const enabled = "bar";
        props.onSetForceReset(userId, enabled);
        expect(dispatch).toHaveBeenCalledWith(editUser(userId, { force_reset: enabled }));
    });
});
