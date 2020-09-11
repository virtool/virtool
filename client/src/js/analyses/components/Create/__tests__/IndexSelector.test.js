import { IndexSelector } from "../IndexSelector.js";

describe("<IndexSelector />", () => {
    let props;

    beforeEach(() => {
        props = {
            indexes: [{ id: "foo" }, { id: "bar" }, { id: "baz" }],
            onSelect: jest.fn(),
            selected: [{ id: "foo" }, { id: "bar" }],
            error: ""
        };
    });

    it("should render", () => {
        const wrapper = shallow(<IndexSelector {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [indexes.length = 0]", () => {
        props.indexes = [];
        const wrapper = shallow(<IndexSelector {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with error", () => {
        props.error = "Error";
        const wrapper = shallow(<IndexSelector {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
