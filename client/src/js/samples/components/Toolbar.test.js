import * as actions from "../actions";
import SampleToolbar from "./Toolbar";

describe("<SampleToolbar />", () => {
    let initialState;
    let store;
    let wrapper;

    it("renders correctlty", () => {
        initialState = {
            samples: {
                filter: "test"
            },
            account: {
                administrator: true,
                permissions: { foo: false }
            }
        };
        store = mockStore(initialState);

        wrapper = shallow(<SampleToolbar store={store} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    it("Change in input dispatches filterSamples() action", () => {
        const spy = sinon.spy(actions, "filterSamples");
        expect(spy.called).toBe(false);

        initialState = {
            samples: {
                filter: "search"
            },
            account: {
                administrator: false,
                permissions: { foo: false }
            }
        };
        store = mockStore(initialState);

        wrapper = mount(<SampleToolbar store={store} />);

        wrapper
            .find({ placeholder: "Sample name" })
            .at(0)
            .prop("onChange")({ target: { value: "test-input" } });
        expect(spy.calledWith("test-input")).toBe(true);

        spy.restore();
    });
});
