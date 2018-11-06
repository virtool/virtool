import * as actions from "../../../actions";
import RemoveIsolate from "../RemoveIsolate";

describe("<RemoveIsolate />", () => {
    const initialState = { otus: { removeIsolate: true } };
    const store = mockStore(initialState);
    const props = {
        otuId: "test-otu",
        isolateId: "123abc",
        nextIsolateId: "test-next-isolate",
        isolateName: "test-isolate"
    };
    let wrapper;

    it("renders correctly", () => {
        wrapper = shallow(<RemoveIsolate store={store} {...props} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    describe("dispatch functions", () => {
        let spy;

        beforeEach(() => {
            wrapper = shallow(<RemoveIsolate store={store} {...props} />).dive();
        });

        afterEach(() => {
            spy.restore();
        });

        it("Closing modal dispatches hideOTUmodal() action", () => {
            spy = sinon.spy(actions, "hideOTUModal");
            expect(spy.called).toBe(false);

            wrapper.prop("onHide")();

            expect(spy.calledOnce).toBe(true);
        });

        it("Clicking Confirm dispatches removeIsolate() action", () => {
            spy = sinon.spy(actions, "removeIsolate");
            expect(spy.called).toBe(false);

            wrapper.prop("onConfirm")();

            expect(spy.calledWith(props.otuId, props.isolateId, props.nextIsolateId)).toBe(true);
        });
    });
});
