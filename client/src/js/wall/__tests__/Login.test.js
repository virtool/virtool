import { LOGIN } from "../../app/actionTypes";
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
        wrapper.setState({
            username: "bob",
            password: "hello world"
        });
        expect(wrapper).toMatchSnapshot();
    });

    it("should render checked remember checkbox", () => {
        const wrapper = shallow(<Login {...props} />);
        wrapper.setState({
            remember: true
        });
        expect(wrapper).toMatchSnapshot();
    });

    it("should set state when username changes", () => {
        const wrapper = shallow(<Login {...props} />);
        const username = wrapper.find("Input").at(0);
        username.simulate("change", {
            target: {
                name: "username",
                value: "bob"
            }
        });
        expect(wrapper.state()).toEqual({
            username: "bob",
            password: "",
            remember: false
        });
    });

    it("should set state when password changes", () => {
        const wrapper = shallow(<Login {...props} />);
        const password = wrapper.find("Input").at(1);
        password.simulate("change", {
            target: {
                name: "password",
                value: "foobar"
            }
        });
        expect(wrapper.state()).toEqual({
            username: "",
            password: "foobar",
            remember: false
        });
    });

    it("should set state when checkbox is clicked", () => {
        const wrapper = shallow(<Login {...props} />);
        expect(wrapper.state()).toEqual({
            username: "",
            password: "",
            remember: false
        });
        const checkbox = wrapper.find("Checkbox");
        checkbox.simulate("click");
        expect(wrapper.state()).toEqual({
            username: "",
            password: "",
            remember: true
        });
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
            remember: false,
            key: "baz"
        });
    });
});
