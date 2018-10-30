import * as actions from "../../actions";
import NuVsBLASTContainer, { BLASTInProgress, BLASTResults, NuVsBLAST } from "./BLAST";

describe("<NuVsBLAST />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        props = {
            blast: {
                ready: true,
                result: {
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
                }
            },
            analysisId: "123abc"
        };
        wrapper = shallow(<NuVsBLAST {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders correctly with no BLAST hits", () => {
        props = {
            analysisId: "123abc",
            blast: { ready: true, result: { hits: [] } }
        };
        wrapper = shallow(<NuVsBLAST {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders correctly with in progress BLAST", () => {
        props = {
            analysisId: "123abc",
            blast: {
                ready: false,
                interval: 5,
                last_checked_at: "2018-02-14T17:12:00.000000Z",
                rid: "ABC123"
            }
        };
        wrapper = shallow(<NuVsBLAST {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders alert when no blast data available", () => {
        props = { analysisId: "123abc", blast: null };
        wrapper = shallow(<NuVsBLAST {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders <BLASTInProgress /> subcomponent", () => {
        props = {
            interval: 5,
            lastCheckedAt: "2018-02-14T17:12:00.000000Z",
            rid: "ABC123"
        };
        wrapper = shallow(<BLASTInProgress {...props} />);
        expect(wrapper).toMatchSnapshot();

        wrapper.setProps({ rid: null });
        expect(wrapper).toMatchSnapshot();
    });

    it("renders <BLASTResults /> component", () => {
        props = {
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
        wrapper = shallow(<BLASTResults {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("Clicking BLAST button dispatches blastNuvs() action", () => {
        const spy = sinon.spy(actions, "blastNuvs");
        expect(spy.called).toBe(false);

        const initialState = { analyses: { detail: { id: "123abc" } } };
        const store = mockStore(initialState);
        props = { blast: null, sequenceIndex: 0 };

        wrapper = shallow(<NuVsBLASTContainer store={store} {...props} />).dive();
        wrapper.find({ icon: "cloud" }).prop("onClick")();
        expect(spy.calledWith("123abc", 0)).toBe(true);

        spy.restore();
    });
});
