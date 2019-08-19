import HMM from "../HMM";

describe("<HMM />", () => {
    it("should render", () => {
        const wrapper = shallow(<HMM />);
        expect(wrapper).toMatchSnapshot();
    });
});
