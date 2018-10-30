import HMM from "./HMM";

describe("<HMM />", () => {
    it("renders correctly", () => {
        const wrapper = shallow(<HMM />);

        expect(wrapper).toMatchSnapshot();
    });
});
