import NuVsItem from "../Item";

describe("<NuVsItem />", () => {
    let props;

    beforeEach(() => {
        props = {
            in: false,
            index: 4,
            sequence: "test-sequence",
            orfs: [],
            e: 3,
            toggleIn: jest.fn()
        };
    });

    it("should render collapsed when [in=false]", () => {
        const wrapper = shallow(<NuVsItem {...props} />);
        expect(wrapper).toMatchSnapshot();

        wrapper.setProps({ ...props, in: true });
        expect(wrapper).toMatchSnapshot();
    });

    it("should render expanded when [in=true]", () => {
        props.in = true;
        const wrapper = shallow(<NuVsItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call toggleIn(index) when clicked", () => {
        const wrapper = shallow(<NuVsItem {...props} />);
        wrapper.simulate("click");
        expect(props.toggleIn).toHaveBeenCalledWith(props.index);
    });
});
