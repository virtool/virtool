import NuVsEntry from "../Entry";

describe("<NuVsEntry />", () => {
    let props;

    beforeEach(() => {
        props = {
            in: false,
            index: 4,
            sequence: "test-sequence",
            orfs: [],
            minE: 3,
            toggleIn: jest.fn()
        };
    });

    it("should render collapsed when [in=false]", () => {
        const wrapper = shallow(<NuVsEntry {...props} />);
        expect(wrapper).toMatchSnapshot();

        wrapper.setProps({ ...props, in: true });
        expect(wrapper).toMatchSnapshot();
    });

    it("should render expanded when [in=true]", () => {
        props.in = true;
        const wrapper = shallow(<NuVsEntry {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call toggleIn(true) when clicked and not expanded", () => {
        const wrapper = shallow(<NuVsEntry {...props} />);
        wrapper.simulate("click");
        expect(props.toggleIn).toHaveBeenCalledWith(props.index);
    });

    it("should not call toggleIn(true) when clicked and expanded", () => {
        props.in = true;
        const wrapper = shallow(<NuVsEntry {...props} />);
        wrapper.simulate("click");
        expect(props.toggleIn).not.toHaveBeenCalled();
    });

    it("should call toggleIn(false) when close button clicked", () => {
        props.in = true;
        const wrapper = shallow(<NuVsEntry {...props} />);
        wrapper.find("button").simulate("click");
        expect(props.toggleIn).toHaveBeenCalledWith(props.index);
    });
});
