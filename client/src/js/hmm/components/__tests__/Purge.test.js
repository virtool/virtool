import { HMMPurge } from "../Purge";

describe("<HMMPurge />", () => {
    let props;

    beforeEach(() => {
        props = {
            canPurge: true,
            onPurge: jest.fn()
        };
    });

    it("should render purge button when [canPurge=true]", () => {
        const wrapper = shallow(<HMMPurge {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should not render" + " purge button when [canPurge=false]", () => {
        props.canPurge = false;
        const wrapper = shallow(<HMMPurge {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onPurge when button clicked", () => {
        const wrapper = shallow(<HMMPurge {...props} />);
        wrapper.find("RemoveBanner").simulate("click");
        expect(props.onPurge).toHaveBeenCalled();
    });
});
