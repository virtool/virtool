import { LOGIN } from "../../app/actionTypes";
import { Checkbox, Input, PasswordInput } from "../../base";
import { Login, mapStateToProps, mapDispatchToProps } from "../Login";

describe("<Login />", () => {
    let props;

    beforeEach(() => {
        props = {
            onLogin: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<Login {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render filled username and password fields", () => {
        const wrapper = shallow(<Login {...props} />);
        expect(wrapper).toMatchSnapshot();

        const username = wrapper.find(Input).at(0);
        username.simulate("change", {
            target: {
                name: "username",
                value: "bob"
            }
        });
        expect(wrapper).toMatchSnapshot();

        const password = wrapper.find(PasswordInput);
        password.simulate("change", {
            target: {
                name: "password",
                value: "foobar"
            }
        });
        expect(wrapper).toMatchSnapshot();
    });

    it("should render checked remember checkbox", () => {
        const wrapper = shallow(<Login {...props} />);
        expect(wrapper).toMatchSnapshot();

        wrapper.find(Checkbox).simulate("click");
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onLogin() and e.preventDefault() when submitted", () => {
        const wrapper = shallow(<Login {...props} />);
        wrapper.setState({
            username: "bob",
            password: "foobar",
            remember: true
        });
        const form = wrapper.find("form");
        const e = {
            preventDefault: jest.fn()
        };
        form.simulate("submit", e);
        expect(props.onLogin).toHaveBeenCalledWith("bob", "foobar", true);
        expect(e.preventDefault).toHaveBeenCalled();
    });
});

describe("mapStateToProps()", () => {
    it("should return props given state", () => {
        const state = {
            app: {}
        };
        const result = mapStateToProps(state);
        expect(result).toEqual({});
    });
});

describe("mapDispatchToProps()", () => {
    it("should return props with valid onLogin()", () => {
        const dispatch = jest.fn();
        const props = mapDispatchToProps(dispatch);
        props.onLogin("bob", "foobar", false, "baz");
        expect(dispatch).toHaveBeenCalledWith({
            type: LOGIN.REQUESTED,
            username: "bob",
            password: "foobar",
            remember: false
        });
    });
});
