import { AnalysisDetail, mapStateToProps } from "../Detail";

describe("<AnalysisDetail />", () => {
    let props;

    beforeEach(() => {
        props = {
            detail: {
                id: "foo",
                created_at: "2019-05-28T19:04:25.201000Z",
                algorithm: "pathoscope_bowtie",
                ready: true,
                user: {
                    id: "bob"
                }
            },
            error: null,
            quality: {
                read_count: 1432
            },
            sampleName: "bar",
            match: {
                params: {
                    analysisId: "foo"
                }
            }
        };
    });

    it("should render", () => {
        const wrapper = shallow(<AnalysisDetail {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render message when error is not null", () => {
        props = {
            ...props,
            detail: null,
            error: {
                id: "test_error"
            }
        };
        const wrapper = shallow(<AnalysisDetail {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render loading when [detail=null]", () => {
        props.detail = null;
        const wrapper = shallow(<AnalysisDetail {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render pending when [detail.ready=false]", () => {
        props.detail.ready = false;
        const wrapper = shallow(<AnalysisDetail {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render expected view when [detail.algorithm='nuvs']", () => {
        props.detail.algorithm = "nuvs";
        const wrapper = shallow(<AnalysisDetail {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render error when detail.algorithm is invalid]", () => {
        props.detail.algorithm = "baz";
        const wrapper = shallow(<AnalysisDetail {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps", () => {
    let state;
    let expected;

    beforeEach(() => {
        state = {
            analyses: {
                detail: {
                    id: "foo"
                }
            },
            errors: {
                GET_SAMPLE_ERROR: {
                    id: "test_error"
                }
            },
            samples: {
                detail: {
                    name: "Baz",
                    quality: { read_count: 1231 }
                }
            }
        };

        expected = {
            detail: {
                id: "foo"
            },
            error: null,
            quality: {
                read_count: 1231
            },
            sampleName: "Baz"
        };
    });

    it("should return props", () => {
        const props = mapStateToProps(state);
        expect(props).toEqual(expected);
    });

    it("should return error when it exists", () => {
        const error = {
            id: "test_get_analysis_error"
        };

        state.errors.GET_ANALYSIS_ERROR = error;

        const props = mapStateToProps(state);

        expect(props).toEqual({
            ...expected,
            error
        });
    });
});
