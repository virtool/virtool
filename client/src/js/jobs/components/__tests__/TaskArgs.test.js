import TaskArgs from "../TaskArgs";

describe("<TaskArgs />", () => {
    let props;
    let wrapper;

    it("renders nuvs job", () => {
        props = {
            taskType: "nuvs",
            taskArgs: {
                sample_id: "123abc",
                sample_name: "test-nuvs",
                analysis_id: "test-analysis"
            }
        };
        wrapper = shallow(<TaskArgs {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders pathoscope_bowtie job", () => {
        props = {
            taskType: "pathoscope_bowtie",
            taskArgs: {
                sample_id: "456def",
                sample_name: "test-pathoscope",
                analysis_id: "test-analysis"
            }
        };
        wrapper = shallow(<TaskArgs {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders rebuild_index job", () => {
        props = {
            taskType: "rebuild_index",
            taskArgs: { index_version: 0 }
        };
        wrapper = shallow(<TaskArgs {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders other types of jobs", () => {
        props = {
            taskType: "test_job",
            taskArgs: {
                test: { hello: "world" },
                manifest: { foo: "bar" }
            }
        };
        wrapper = shallow(<TaskArgs {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
