import { BLASTInProgress, BLASTResults, NuVsBLAST } from "../BLAST";

describe("<BLASTInProgress />", () => {
    it.each(["ABC123", null])("should render when [rid=%p]", rid => {
        const wrapper = shallow(
            <BLASTInProgress interval={5} lastCheckedAt={"2018-02-14T17:12:00.000000Z"} rid={rid} />
        );
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<BLASTResults />", () => {
    it("should render", () => {
        const props = {
            hits: [
                {
                    name: "test",
                    accession: "NC123",
                    evalue: 3,
                    score: 1,
                    identity: 2,
                    align_len: 4
                }
            ]
        };
        const wrapper = shallow(<BLASTResults {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<NuVsBLAST />", () => {
    let props;

    beforeEach(() => {
        props = {
            blast: {
                ready: true,
                result: {
                    hits: [
                        {
                            name: "bar",
                            accession: "BAR123",
                            evalue: 3,
                            score: 1,
                            identity: 2,
                            align_len: 4
                        }
                    ]
                }
            },
            analysisId: "foo",
            sequenceIndex: 5,
            onBlast: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<NuVsBLAST {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with no BLAST hits", () => {
        props.blast.result.hits = [];
        const wrapper = shallow(<NuVsBLAST {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with an in-progress BLAST", () => {
        props.blast = {
            ready: false,
            interval: 5,
            last_checked_at: "2018-02-14T17:12:00.000000Z",
            rid: "ABC123"
        };
        const wrapper = shallow(<NuVsBLAST {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render alert when no blast data available", () => {
        props.blast = null;
        const wrapper = shallow(<NuVsBLAST {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call blastNuvs() when BLAST button clicked", () => {
        props.blast = null;
        const wrapper = shallow(<NuVsBLAST {...props} />);
        wrapper.find("Button").simulate("click");
        expect(props.onBlast).toHaveBeenCalledWith(props.analysisId, props.sequenceIndex);
    });
});
