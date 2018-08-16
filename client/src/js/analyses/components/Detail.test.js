import AnalysisDetail from "./Detail";

describe("<AnalysisDetail />", () => {
    const initialState = {
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
    const store = mockStore(initialState);
    let props;
    let wrapper;

    it("renders correctly", () => {
        props = {
            match: {
                params: {
                    analysisId: "test-analysis"
                }
            }
        };
        wrapper = shallow(<AnalysisDetail store={store} {...props} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

});
