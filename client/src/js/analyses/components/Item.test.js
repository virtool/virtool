import AnalysisItemContainer from "./Item";

describe("<AnalysisItem />", () => {
    const initialState = {
        references: {
            detail: {
                restrict_source_types: false,
                id: "123abc",
                remotes_from: null,
                source_types: []
            }
        },
        account: {
            administrator: false,
            groups: []
        },
        settings: {
            data: {
                default_source_types: []
            }
        },
        samples: {
            detail: null
        }
    };
    const store = mockStore(initialState);
    let props;
    let wrapper;

    it("renders correctly", () => {
        props = {
            id: "test_analysis",
            ready: false,
            placeholder: true,
            algorithm: "test_algorithm",
            created_at: "2018-02-14T17:12:00.000000Z"
        };
        wrapper = shallow(<AnalysisItemContainer store={store} {...props} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

});
