import { Input } from "../../../base";
import { Email, EmailForm } from "../Email";

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

    it("should render", () => {
        const wrapper = shallow(<Email {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render without initial email", () => {
        props.email = "";
        const wrapper = shallow(<Email {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when submitted value is invalid error", () => {
        const wrapper = shallow(<Email {...props} />);

        // Change value and check snapshot.
        const e = {
            target: {
                name: "email",
                value: "not_an_email"
            }
        };
        wrapper.find(Input).simulate("change", e);
        expect(wrapper).toMatchSnapshot();

        // Submit and check that error is in snapshot.
        const preventDefault = jest.fn();
        wrapper.find(EmailForm).simulate("submit", { preventDefault });
        expect(preventDefault).toHaveBeenCalledWith();
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when when input changes", () => {
        const wrapper = shallow(<Email {...props} />);
        const e = {
            target: {
                value: "bar@example.com"
            }
        };
        wrapper.find(Input).simulate("change", e);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onUpdateEmail() when valid form submitted", () => {
        const wrapper = shallow(<Email {...props} />);
        const email = "baz@example.com";

        // Set email value and check snapshot.
        wrapper.setState({ email });
        expect(wrapper).toMatchSnapshot();

        // Submit and check snapshot.
        const preventDefault = jest.fn();
        wrapper.find(EmailForm).simulate("submit", { preventDefault });
        expect(preventDefault).toHaveBeenCalled();
        expect(props.onUpdateEmail).toHaveBeenCalledWith(email);
    });
});
