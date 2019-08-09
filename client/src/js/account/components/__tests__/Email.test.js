import { Email } from "../Email";

describe("<Email />", () => {
    let props;

    beforeEach(() => {
        props = {
            email: "foo@example.com",
            error: undefined,
            onUpdateEmail: jest.fn(),
            onClearError: jest.fn()
        };
    });

    it("should render with initial email", () => {
        const wrapper = shallow(<Email {...props} />);
        expect(wrapper.state("email")).toBe(props.email);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render without initial email", () => {
        props.email = "";
        const wrapper = shallow(<Email {...props} />);
        expect(wrapper.state("email")).toBe("");
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with error in state", () => {
        const wrapper = shallow(<Email {...props} />);
        wrapper.setState({ error: "Foo error" });
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with error in props", () => {
        props.error = "Bar error";
        const wrapper = shallow(<Email {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should update state and when input changes", () => {
        const wrapper = shallow(<Email {...props} />);
        const e = {
            target: {
                value: "bar@example.com"
            }
        };
        wrapper.find("InputError").simulate("change", e);
        expect(wrapper.state("email")).toBe("bar@example.com");
        expect(props.onClearError).not.toHaveBeenCalled();
    });

    it("should call onClearError when input changes if there is a preexisting error", () => {
        props.error = "Invalid email address";
        const wrapper = shallow(<Email {...props} />);
        const e = {
            target: {
                value: "bar@example.com"
            }
        };
        wrapper.find("InputError").simulate("change", e);
        expect(props.onClearError).toHaveBeenCalled();
    });

    it("should call onUpdateEmail() and e.preventDefault() when valid form submitted", () => {
        const wrapper = shallow(<Email {...props} />);
        const email = "baz@example.com";
        wrapper.setState({ email });
        const e = {
            preventDefault: jest.fn()
        };
        wrapper.find("form").simulate("submit", e);
        expect(e.preventDefault).toHaveBeenCalled();
        expect(props.onUpdateEmail).toHaveBeenCalledWith(email);
    });

    it("should set error if submitted form has a client-detectable error", () => {
        const wrapper = shallow(<Email {...props} />);
        wrapper.setState({ email: "baz" });
        const e = {
            preventDefault: jest.fn()
        };
        wrapper.find("form").simulate("submit", e);
        expect(e.preventDefault).toHaveBeenCalled();
        expect(props.onUpdateEmail).not.toHaveBeenCalledWith();
        expect(wrapper.state()).toEqual({
            email: "baz",
            error: "Please provide a valid email address"
        });
    });
});
