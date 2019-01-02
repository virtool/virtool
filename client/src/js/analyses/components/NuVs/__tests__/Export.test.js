import { NuVsExport } from "../Export";

describe("<NuVsExport />", () => {
    it("renders correctly", () => {
        const props = {
            show: true,
            sampleName: "test-sample",
            analysisId: "test-analysis",
            results: [],
            onHide: jest.fn()
        };
        const wrapper = <NuVsExport {...props} />;
        expect(wrapper).toMatchSnapshot();
    });
});
