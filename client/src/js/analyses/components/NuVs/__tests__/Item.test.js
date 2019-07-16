import { NuVsItem } from "../Item";

describe("<NuVsItem />", () => {
    let props;

    beforeEach(() => {
        props = {
            active: false,
            e: 0.0012,
            sequence: "ATATAGAGAACAT",
            sequenceIndex: 4,
            orfs: [
                {
                    hits: [1, 2]
                },
                {
                    hits: [1]
                }
            ],
            onSetActiveId: jest.fn()
        };
    });

    it("should render when not active", () => {
        const wrapper = shallow(<NuVsItem {...props} />);
        expect(wrapper).toMatchSnapshot();

        wrapper.setProps({ ...props, expanded: true });
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when active", () => {
        props.active = true;
        const wrapper = shallow(<NuVsItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onSetActiveId(index) when clicked", () => {
        const wrapper = shallow(<NuVsItem {...props} />);
        wrapper.simulate("click");
        expect(props.onSetActiveId).toHaveBeenCalledWith(props.sequenceIndex);
    });
});
