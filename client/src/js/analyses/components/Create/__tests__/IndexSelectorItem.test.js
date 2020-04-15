import { IndexSelectorItem } from "../IndexSelectorItem.js";

describe("<IndexSelectorItem />", () => {
    let props;

    beforeEach(() => {
        props = {
            reference: {
                id: "foo",
                name: "bar"
            },
            id: "baz",
            isSelected: true,
            verision: 1,
            onSelect: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<IndexSelectorItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [isSelected = false]", () => {
        props.isSelected = false;
        const wrapper = shallow(<IndexSelectorItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onSelect when component is clicked", () => {
        const wrapper = shallow(<IndexSelectorItem {...props} />);
        expect(props.onSelect).not.toHaveBeenCalled();
        wrapper.simulate("click");
        expect(props.onSelect).toHaveBeenCalled();
    });
});
