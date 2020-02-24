import {
    AnalysisRows,
    BuildIndexRows,
    CreateSampleRows,
    CreateSubtractionRows,
    TaskArgsRows,
    UpdateSampleRows
} from "../TaskArgs";

const taskTypes = ["aodp", "build_index", "create_sample", "create_subtraction", "pathoscope_bowtie", "nuvs", "update_sample"];

describe("<TaskArgs />", () => {
    let props;

    it.each(taskTypes)("renders <TaskArgsRows /> correctly when task type is %p", taskType => {
        props = {
            taskType,
            taskArgs: {
                sample_id: "123abc",
                analysis_id: "test-analysis"
            }
        };
        const wrapper = shallow(<TaskArgsRows {...props} />);
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
