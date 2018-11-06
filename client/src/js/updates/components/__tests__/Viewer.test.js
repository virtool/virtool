import { Provider } from "react-redux";
import * as actions from "../../actions";
import SoftwareUpdateViewer from "../Viewer";

describe("<SoftwareUpdateViewer />", () => {
    let initialState;
    let store;
    let wrapper;

    it("renders correctly when releases data available", () => {
        initialState = {
            settings: { data: { software_channel: "stable" } },
            updates: { releases: [] }
        };
        store = mockStore(initialState);
        wrapper = shallow(<SoftwareUpdateViewer store={store} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    it("renders <LoadingPlaceholder /> when releases data not available", () => {
        initialState = {
            settings: { data: { software_channel: "stable" } },
            updates: { releases: null }
        };
        store = mockStore(initialState);
        wrapper = shallow(<SoftwareUpdateViewer store={store} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    it("Dispatches getSoftwareUpdates() action on component mount", () => {
        const spy = sinon.spy(actions, "getSoftwareUpdates");
        expect(spy.called).toBe(false);

        wrapper = mount(
            <Provider store={store}>
                <SoftwareUpdateViewer />
            </Provider>
        );
        expect(spy.calledOnce).toBe(true);

        spy.restore();
    });
});
