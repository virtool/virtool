import APIContainer, { APIKeys } from "./API";
import * as actions from "../../actions";

describe("<API />", () => {
    let initialState;
    let store;
    let wrapper;

    it("renders correctly with existing API keys", () => {
        initialState = {
            account: {
                apiKeys: [
                    { id: "test1" },
                    { id: "test2" }
                ]
            }
        };
        store = mockStore(initialState);

        wrapper = shallow(<APIContainer store={store} />).dive();

        expect(wrapper).toMatchSnapshot();
    });

    it("renders correctly without API keys", () => {
        initialState = {
            account: {
                apiKeys: null
            }
        };
        store = mockStore(initialState);

        wrapper = shallow(<APIContainer store={store} />).dive();

        expect(wrapper).toMatchSnapshot();
    });

    it("renders correctly with 0 API keys", () => {
        initialState = {
            account: {
                apiKeys: []
            }
        };
        store = mockStore(initialState);

        wrapper = shallow(<APIContainer store={store} />).dive();

        expect(wrapper).toMatchSnapshot();
    });

});
