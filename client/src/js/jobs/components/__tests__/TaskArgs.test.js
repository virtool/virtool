import {
    AnalysisRows,
    BuildIndexRows,
    CreateSampleRows,
    CreateSubtractionRows,
    JobArgsRows,
    UpdateSampleRows
} from "../JobArgs";

const workflows = [
    "aodp",
    "build_index",
    "create_sample",
    "create_subtraction",
    "pathoscope_bowtie",
    "nuvs",
    "update_sample"
];

describe("<JobArgs />", () => {
    it.each(workflows)("renders <JobArgsRows /> correctly when workflow is %p", workflow => {
        const args = {
            sample_id: "123abc",
            analysis_id: "test-analysis"
        };

        const wrapper = shallow(<JobArgsRows workflow={workflow} args={args} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<AnalysisRows />", () => {
    it("renders correctly", () => {
        const wrapper = shallow(<AnalysisRows analysis_id="foo" sample_id="bar" />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<BuildIndexRows />", () => {
    it("renders correctly", () => {
        const wrapper = shallow(<BuildIndexRows ref_id="foo" index_id="bar" />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<CreateSampleRows />", () => {
    it("renders correctly", () => {
        const wrapper = shallow(<CreateSampleRows sample_id="foo" />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<CreateSubtractionRows />", () => {
    it("renders correctly", () => {
        const wrapper = shallow(<CreateSubtractionRows subtraction_id="foo" />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<UpdateSampleRows />", () => {
    it("renders correctly", () => {
        const wrapper = shallow(<UpdateSampleRows sample_id="foo" />);
        expect(wrapper).toMatchSnapshot();
    });
});
