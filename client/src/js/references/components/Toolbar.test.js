import * as actions from "../actions";
import ReferenceToolbar from "./Toolbar";

describe("<ReferenceToolbar />", () => {
    const initialState = {
        references: {
            filter: "test"
        }
    };
    const store = mockStore(initialState);
    let props;
    let wrapper;

    it("renders correctly", () => {
        props = { canCreate: true };
        wrapper = shallow(<ReferenceToolbar store={store} {...props} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    it("Change in input dispatches filterReferences() action", () => {
        const spy = sinon.spy(actions, "filterReferences");
        expect(spy.called).toBe(false);

        props = { canCreate: false };
        wrapper = mount(<ReferenceToolbar store={store} {...props} />);
        wrapper.find("input").prop("onChange")({ target: { value: "test-input" } });
        expect(spy.calledWith("test-input")).toBe(true);

        spy.restore();
    });
});
