import HMMSettings from "../Settings";

describe("<HMMSettings />", () => {
    it("should render", () => {
        const wrapper = shallow(<HMMSettings />);
        expect(wrapper).toMatchSnapshot();
    });
});
