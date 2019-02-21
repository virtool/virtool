import HMMSettings from "../Settings";

describe("<HMMSettings />", () => {
    it("renders", () => {
        const wrapper = shallow(<HMMSettings />);
        expect(wrapper).toMatchSnapshot();
    });
});
