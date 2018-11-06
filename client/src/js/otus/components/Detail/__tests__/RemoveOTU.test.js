import { Modal } from "react-bootstrap";
import { Button } from "../../../../base/index";
import * as actions from "../../../actions";
import RemoveOTU from "../RemoveOTU";

describe("<RemoveOTU />", () => {
    const initialState = {
        otus: { remove: true },
        references: { detail: { id: "123abc" } }
    };
    const store = mockStore(initialState);
    const props = {
        history: {},
        otuId: "456def",
        otuName: "test-otu"
    };
    let wrapper;

    it("renders correctly", () => {
        wrapper = shallow(<RemoveOTU store={store} {...props} />).dive();
        expect(wrapper).toMatchSnapshot();
    });

    describe("dispatch functions", () => {
        let spy;

        afterEach(() => {
            spy.restore();
        });

        it("Closing modal dispatches hideOTUModal() action", () => {
            spy = sinon.spy(actions, "hideOTUModal");
            expect(spy.called).toBe(false);

            wrapper = mount(<RemoveOTU store={store} {...props} />);
            wrapper.find(Modal).prop("onHide")();

            expect(spy.calledOnce).toBe(true);
        });

        it("Clicking Confirm button dispatches removeOTU() action", () => {
            spy = sinon.spy(actions, "removeOTU");
            expect(spy.called).toBe(false);

            wrapper = mount(<RemoveOTU store={store} {...props} />);
            wrapper.find(Button).prop("onClick")();

            expect(spy.calledWith("123abc", "456def", {})).toBe(true);
        });
    });
});
