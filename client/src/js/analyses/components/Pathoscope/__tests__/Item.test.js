import * as actions from "../../../actions";
import PathoscopeItemContainer from "../Item";

describe("<PathoscopeItem />", () => {
    let initialState;
    let store;
    let props;
    let wrapper;

    it("renders correctly", () => {
        initialState = {
            analyses: {
                data: [],
                showMedian: false,
                showReads: false
            }
        };
        store = mockStore(initialState);

        props = {
            expanded: false,
            reads: 20,
            pi: 30,
            id: "123abc",
            name: "test",
            abbreviation: "T",
            depth: 1,
            coverage: 0.001
        };
        wrapper = shallow(<PathoscopeItemContainer store={store} {...props} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    it("Clicking close button or list entry dispatches toggleExpanded() action", () => {
        const spy = sinon.spy(actions, "toggleExpanded");
        expect(spy.called).toBe(false);

        initialState = {
            analyses: {
                data: [],
                showMedian: true,
                showReads: true
            }
        };
        store = mockStore(initialState);

        props = {
            expanded: true,
            reads: 10,
            pi: 5,
            id: "123abc",
            name: "test",
            abbreviation: "T",
            depth: 0,
            coverage: 0.1
        };

        wrapper = mount(<PathoscopeItemContainer store={store} {...props} />);
        wrapper.find("button").prop("onClick")();

        expect(spy.calledWith(props.id)).toBe(true);
        expect(spy.calledOnce).toBe(true);

        wrapper.setProps({ expanded: false });

        wrapper.find(".list-group-item").prop("onClick")();
        expect(spy.calledTwice).toBe(true);

        spy.restore();
    });
});
