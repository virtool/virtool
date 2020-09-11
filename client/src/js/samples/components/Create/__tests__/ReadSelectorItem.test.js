import { ReadSelectorItem, ReadOrientation } from "../ReadSelectorItem";

describe("<ReadOrientation />", () => {
    let props;
    beforeEach(() => {
        props = {
            index: 0,
            selected: true
        };
    });

    it("should render when [index=0]", () => {
        const wrapper = shallow(<ReadOrientation {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should render when [index=1]", () => {
        props.index = 1;
        const wrapper = shallow(<ReadOrientation {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should render when [selected=true]", () => {
        const wrapper = shallow(<ReadOrientation {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should render when [selected=false]", () => {
        props.selected = false;
        const wrapper = shallow(<ReadOrientation {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<ReadSelectorItem />", () => {
    let props;
    beforeEach(() => {
        props = {
            id: "foo",
            index: 0,
            name: "bar",
            selected: true,
            size: 0,
            onSelect: jest.fn()
        };
    });

    it("should render when [selected=true]", () => {
        const wrapper = shallow(<ReadSelectorItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should render when [selected=false]", () => {
        props.selected = false;
        const wrapper = shallow(<ReadSelectorItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should call onSelect when ReadSelectorItem is clicked", () => {
        const wrapper = shallow(<ReadSelectorItem {...props} />);
        wrapper.simulate("click");
        expect(props.onSelect).toHaveBeenCalledWith("foo");
    });
});
