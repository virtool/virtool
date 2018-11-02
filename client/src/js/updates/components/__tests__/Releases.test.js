import { push } from "react-router-redux";
import Releases from "../Releases";

describe("<Releases />", () => {
    let initialState;
    let store;
    let wrapper;

    it("renders correctly when there are no releases", () => {
        initialState = {
            updates: {
                releases: []
            }
        };
        store = mockStore(initialState);

        wrapper = shallow(<Releases store={store} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    it("renders correctly when there are multiple releases", () => {
        initialState = {
            updates: {
                releases: [{ name: "test-b" }, { name: "test-c" }]
            }
        };
        store = mockStore(initialState);

        wrapper = shallow(<Releases store={store} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    it("clicking Install button dispatches router location state change", () => {
        initialState = {
            updates: {
                releases: [{ name: "test-a" }]
            }
        };
        store = mockStore(initialState);

        const spy = sinon.spy(store, "dispatch");
        expect(spy.called).toBe(false);

        wrapper = shallow(<Releases store={store} />);
        wrapper
            .dive()
            .find({ icon: "download" })
            .prop("onClick")();

        expect(spy.calledWith(push({ state: { install: true } }))).toBe(true);

        spy.restore();
    });
});
