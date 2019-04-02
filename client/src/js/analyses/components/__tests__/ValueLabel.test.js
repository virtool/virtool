import AnalysisValueLabel from "../ValueLabel";

describe("<AnalysisValue />", () => {
    let wrapper;

    it("renders correctly with props", () => {
        const props = {
            bsStyle: "danger",
            label: "test",
            value: "example"
        };
        wrapper = shallow(<AnalysisValueLabel {...props} />);

        expect(wrapper).toMatchSnapshot();
    });

    it("renders correctly without props", () => {
        wrapper = shallow(<AnalysisValueLabel />);

        expect(wrapper).toMatchSnapshot();
    });
});
