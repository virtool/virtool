import NuVsExport from "./Export";

describe("<NuVsExport />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        props = {
            show: true,
            sampleName: "test-sample",
            analysisId: "test-analysis",
            results: [],
            onHide: jest.fn()
        };
        wrapper = shallow(<NuVsExport {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

});
