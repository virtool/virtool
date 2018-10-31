import * as actions from "../../actions";
import RemoveSequence from "./RemoveSequence";

describe("<RemoveSequence />", () => {
    const initialState = { otus: { removeSequence: "test-sequence" } };
    const store = mockStore(initialState);
    const props = {
        otuId: "123abc",
        isolateId: "456def",
        isolateName: "test-isolate"
    };
    let wrapper;

    it("renders correctly", () => {
        wrapper = shallow(<RemoveSequence store={store} {...props} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    describe("dispatch functions", () => {
        let spy;

        beforeAll(() => {
            wrapper = shallow(<RemoveSequence store={store} {...props} />).dive();
        });

        afterEach(() => {
            spy.restore();
        });

        it("Closing modal dispatches hideOTUModal() action", () => {
            spy = sinon.spy(actions, "hideOTUModal");
            expect(spy.called).toBe(false);

            wrapper.prop("onHide")();

            expect(spy.calledOnce).toBe(true);
        });

        it("Clicking Confirm button dispatches removeSequence() action", () => {
            spy = sinon.spy(actions, "removeSequence");
            expect(spy.called).toBe(false);

            wrapper.prop("onConfirm")();

            expect(spy.calledWith(props.otuId, props.isolateId, initialState.otus.removeSequence)).toBe(true);
        });
    });
});
