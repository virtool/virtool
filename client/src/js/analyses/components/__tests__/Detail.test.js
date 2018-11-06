import * as actions from "../../actions";
import AnalysisDetail from "../Detail";

describe("<AnalysisDetail />", () => {
    let initialState;
    let store;
    let props;
    let wrapper;

    beforeEach(() => {
        initialState = {
            errors: null,
            analyses: {
                detail: {
                    created_at: "2018-02-14T17:12:00.000000Z",
                    user: { id: "test-user" },
                    read_count: 456,
                    id: "123abc",
                    index: { version: 1 },
                    reference: {
                        name: "imported",
                        id: "test-reference"
                    },
                    algorithm: "test-algorithm"
                }
            },
            samples: {
                detail: {
                    quality: { count: 123, length: [25, 55] }
                }
            }
        };
        props = { match: { params: { analysisId: "test-analysis" } } };
    });

    it("renders correctly", () => {
        store = mockStore(initialState);
        wrapper = shallow(<AnalysisDetail store={store} {...props} />).dive();
        expect(wrapper).toMatchSnapshot();

        wrapper.setProps({
            detail: {
                ...initialState.analyses.detail,
                ready: true,
                algorithm: "pathoscope_bowtie"
            }
        });
        expect(wrapper).toMatchSnapshot();

        wrapper.setProps({
            detail: {
                ...initialState.analyses.detail,
                ready: true,
                algorithm: "nuvs"
            }
        });
        expect(wrapper).toMatchSnapshot();
    });

    it("throws error on malformed analysis detail", () => {
        store = mockStore(initialState);
        wrapper = shallow(<AnalysisDetail store={store} {...props} />).dive();

        let error;

        try {
            wrapper.setProps({ detail: { ready: true, algorithm: "error" } });
        } catch (e) {
            error = e;
        }

        expect(error).toBeInstanceOf(Error);
    });

    it("renders <NotFound /> if GET_ANALYSIS_ERROR exists in store", () => {
        initialState = {
            ...initialState,
            errors: { GET_ANALYSIS_ERROR: { status: 404 } }
        };
        store = mockStore(initialState);
        wrapper = shallow(<AnalysisDetail store={store} {...props} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    it("renders <LoadingPlaceholder /> when detail data is not available", () => {
        initialState = { ...initialState, analyses: { detail: null } };
        store = mockStore(initialState);
        wrapper = shallow(<AnalysisDetail store={store} {...props} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    describe("Dispatch functions", () => {
        let spy;

        beforeAll(() => {
            initialState = {
                errors: null,
                analyses: {
                    detail: {
                        created_at: "2018-02-14T17:12:00.000000Z",
                        user: { id: "test-user" },
                        read_count: 456,
                        id: "123abc",
                        index: { version: 1 },
                        reference: {
                            name: "imported",
                            id: "test-reference"
                        },
                        algorithm: "test-algorithm"
                    }
                },
                samples: {
                    detail: {
                        quality: { count: 123 }
                    }
                }
            };
            store = mockStore(initialState);
            props = { match: { params: { analysisId: "test-analysis" } } };
        });

        afterEach(() => {
            spy.restore();
        });

        it("Component mount dispatches get() action", () => {
            spy = sinon.spy(actions, "getAnalysis");
            expect(spy.called).toBe(false);

            wrapper = shallow(<AnalysisDetail store={store} {...props} />).dive();

            expect(spy.calledWith("test-analysis")).toBe(true);
        });

        it("Component unmount disptaches clearAnalysis() action", () => {
            spy = sinon.spy(actions, "clearAnalysis");
            expect(spy.called).toBe(false);

            wrapper = shallow(<AnalysisDetail store={store} {...props} />).dive();
            wrapper.unmount();

            expect(spy.calledOnce).toBe(true);
        });
    });
});
