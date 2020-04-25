import { IndexSelectorList } from "../IndexSelectorList.js";

describe("<IndexSelectorList />", () => {
    let props;

    beforeEach(() => {
        props = {
            error: ["foo"],
            indexes: [{ id: "foo" }, { id: "bar" }, { id: "baz" }],
            selected: [{ id: "foo" }, { id: "bar" }],
            onSelect: "Bar"
        };
    });

    it("should render", () => {
        const wrapper = shallow(<IndexSelectorList {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [indexes.length = 0]", () => {
        props.indexes = [];
        const wrapper = shallow(<IndexSelectorList {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [error.length = 0]", () => {
        props.error = [];
        const wrapper = shallow(<IndexSelectorList {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
