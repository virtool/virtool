import { BoxGroupSection, Checkbox, PasswordInput } from "../../../base";
import { Password, mapStateToProps, mapDispatchToProps } from "../Password";
import { editUser } from "../../actions";

describe("<Password />", () => {
    let props;

    beforeEach(() => {
        props = {
            id: "bob",
            forceReset: false,
            lastPasswordChange: "2018-02-14T17:12:00.000000Z",
            minimumPasswordLength: 8,
            onSetForceReset: jest.fn(),
            onSubmit: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<Password {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render error when submitted value too short", () => {
        const wrapper = shallow(<Password {...props} />);
        const e = {
            preventDefault: jest.fn()
        };
        wrapper.find(BoxGroupSection).simulate("submit", e);
        expect(e.preventDefault).toHaveBeenCalled();
    });

    it("should render when PasswordInput value has changed", () => {
        const wrapper = shallow(<Password {...props} />);
        const e = {
            target: {
                name: "password",
                value: "bar"
            }
        };
        wrapper.find(PasswordInput).simulate("change", e);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onSetForceReset() when Checkbox is clicked", () => {
        const wrapper = shallow(<Password {...props} />);
        wrapper.find(Checkbox).simulate("click");
        expect(props.onSetForceReset).toHaveBeenCalledWith("bob", true);
    });

    it("should call onHandleSubmit() when submitted value is long enough", () => {
        const e = {
            preventDefault: jest.fn()
        };
        const wrapper = shallow(<Password {...props} />);

        // Set adequate password value and check that is rendered.
        wrapper.setState({ password: "long_password" });
        expect(wrapper).toMatchSnapshot();

        // Simulate submit and check that form is cleared using snapshot.
        wrapper.find(BoxGroupSection).simulate("submit", e);
        expect(props.onSubmit).toHaveBeenCalledWith("bob", "long_password");
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps()", () => {
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
            minimumPasswordLength: 2
        });
    });
});

describe("mapDispatchToProps()", () => {
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
