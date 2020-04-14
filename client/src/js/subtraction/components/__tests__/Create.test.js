import { Input } from "../../../base";
import { CreateSubtraction, SubtractionFileItem } from "../Create";

describe("<SubtractionFileItem />", () => {
    it.each([true, false])("should render when [active=%p]", active => {
        const props = {
            active,
            name: "test",
            uploaded_at: "2018-02-14T17:12:00.000000Z",
            user: { id: "test-user" }
        };
        const wrapper = shallow(<SubtractionFileItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<CreateSubtraction />", () => {
    let e;
    let props;

    beforeEach(() => {
        e = {
            preventDefault: jest.fn()
        };

        props = {
            show: true,
            files: [{ id: "test" }],
            error: "",
            onCreate: jest.fn(),
            onListFiles: jest.fn(),
            onHide: jest.fn(),
            onClearError: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<CreateSubtraction {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when no files available", () => {
        props.files = [];
        const wrapper = shallow(<CreateSubtraction {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with request error", () => {
        props.error = "Subtraction ID already exists";
        const wrapper = shallow(<CreateSubtraction {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it.each([
        ["name", "Foo"],
        ["nickname", "Bar"]
    ])("should render after %p input changes", (name, value) => {
        const wrapper = shallow(<CreateSubtraction {...props} />);
        wrapper
            .find(Input)
            .at(name === "subtraction" ? 0 : 1)
            .simulate("change", { target: { name, value } });
        expect(wrapper).toMatchSnapshot();
    });

    it("should render error when submitted with no unique name or file entered", () => {
        const wrapper = shallow(<CreateSubtraction {...props} />);
        wrapper.find("form").simulate("submit", e);
        expect(e.preventDefault).toHaveBeenCalledWith();
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onListFiles() when modal enters", () => {
        props.show = false;
        const wrapper = shallow(<CreateSubtraction {...props} />);
        expect(props.onListFiles).not.toHaveBeenCalled();

        wrapper.setProps({ show: true });

        setTimeout(() => expect(props.onListFiles).toHaveBeenCalledWith(), 500);
    });
});
