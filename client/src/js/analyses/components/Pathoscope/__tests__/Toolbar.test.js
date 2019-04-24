import * as actions from "../../../actions";
import PathoscopeToolbarContainer from "../Toolbar";

describe("<Toolbar />", () => {
    const initialState = {
        analyses: {
            detail: {
                id: "foobar"
            },
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

        wrapper.setProps({ sortDescending: true });
        expect(wrapper).toMatchSnapshot();
    });

    describe("dispatch functions", () => {
        let spy;

        beforeAll(() => {
            wrapper = mount(<PathoscopeToolbarContainer store={store} />);
        });

        afterEach(() => {
            spy.restore();
        });

        it("Collapse button click dispatches collapseAnalysis() action", () => {
            spy = sinon.spy(actions, "collapseAnalysis");
            expect(spy.called).toBe(false);

            wrapper.findWhere(node => node.prop("title") === "Collapse").prop("onClick")();

            expect(spy.calledOnce).toBe(true);
        });

        it("Filter button click dispatches setPathoscopeFilter() action", () => {
            spy = sinon.spy(actions, "setPathoscopeFilter");
            expect(spy.called).toBe(false);

            const targetButton = wrapper.findWhere(node => node.prop("title") === "Filter");

            targetButton.prop("onClick")("test");
            expect(spy.calledWith("")).toBe(true);

            targetButton.prop("onClick")("isolates");
            expect(spy.calledWith("isolates")).toBe(true);
        });

        it("Sort List button click dispatches togglePathoscopeSortDescending() action", () => {
            spy = sinon.spy(actions, "togglePathoscopeSortDescending");
            expect(spy.called).toBe(false);

            wrapper.findWhere(node => node.prop("title") === "Sort Direction").prop("onClick")();

            expect(spy.calledOnce).toBe(true);
        });

        it("Label choice dropdown menu click dispatches setSortKey() action", () => {
            spy = sinon.spy(actions, "setSortKey");
            expect(spy.called).toBe(false);

            wrapper.findWhere(node => node.prop("componentClass") === "select").prop("onChange")({
                target: { value: "test" }
            });

            expect(spy.calledWith("test")).toBe(true);
        });

        it("Depth button click dispatches toggleShowPathoscopeMedian() action", () => {
            spy = sinon.spy(actions, "toggleShowPathoscopeMedian");
            expect(spy.called).toBe(false);

            wrapper.findWhere(node => node.prop("title") === "Median Depth").prop("onClick")();

            expect(spy.calledOnce).toBe(true);
        });

        it("Weight format button click dispatches toggleShowPathoscopeReads() action", () => {
            spy = sinon.spy(actions, "toggleShowPathoscopeReads");
            expect(spy.called).toBe(false);

            wrapper.findWhere(node => node.prop("title") === "Weight Format").prop("onClick")();

            expect(spy.calledOnce).toBe(true);
        });
    });
});
