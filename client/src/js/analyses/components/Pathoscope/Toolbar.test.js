import PathoscopeToolbarContainer from "./Toolbar";

describe("<Toolbar />", () => {
    const initialState = {
        analyses: {
            filterIsolates: false,
            filterOTUs: false,
            showMedian: false,
            showReads: false,
            sortDescending: false,
            sortKey: ""
        }
    };
    const store = mockStore(initialState);
    let wrapper;

    it("renders correctly", () => {
        wrapper = shallow(<PathoscopeToolbarContainer store={store} />).dive();
        expect(wrapper).toMatchSnapshot();
    });
});
