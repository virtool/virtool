import App, { InnerContainer, Inner } from "./App";
import { MemoryRouter } from "react-router";
import { LoadingPlaceholder } from "./base";
import { Provider } from "react-redux";
import { Route } from "react-router-dom";

describe("<App />", () => {
    let store;
    let wrapper;

    it("renders correctly", () => {
        store = {
            subscribe: jest.fn(),
            dispatch: jest.fn(),
            getState: jest.fn()
        };
        wrapper = shallow(<App store={store} history={{}} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders <InnerContainer /> HOC subcomponent", () => {
        const state = {
            account: { ready: true },
            settings: { foo: "bar" },
            app: { pending: false }
        };
        store = mockStore(state);
        wrapper = shallow(
            <Provider store={store}>
                <MemoryRouter initialEntries={["/"]}>
                    <InnerContainer />
                </MemoryRouter>
            </Provider>
        ).dive().dive();

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.dive().find(Route).exists()).toBe(true);
    });

    describe("renders <Inner /> subcomponent", () => {
        let props;

        it("renders loading screen when [ready=false]", () => {
            props = { ready: false };
            wrapper = shallow(<Inner {...props} />);
            expect(wrapper.find(LoadingPlaceholder).exists()).toBe(true);
            expect(wrapper).toMatchSnapshot();
        });

        it("renders routes to components when [ready=true]", () => {
            props = { ready: true };
            wrapper = shallow(<Inner {...props} />);
            expect(wrapper).toMatchSnapshot();
        });

    });

});
