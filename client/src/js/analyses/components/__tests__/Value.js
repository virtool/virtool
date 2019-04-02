import AnalysisValue from "../Value";

describe("<AnalysisValue />", () => {
    it("should render", () => {
        const props = {
            color: "red",
            label: "foo",
            value: 1312
        };
        const wrapper = shallow(<AnalysisValue {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render without props", () => {
        const wrapper = shallow(<AnalysisValue />);
        expect(wrapper).toMatchSnapshot();
    });
});
