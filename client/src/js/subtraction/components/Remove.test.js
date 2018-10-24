import { push } from "react-router-redux";
import * as actions from "../actions";
import RemoveSubtractionContainer, { RemoveSubtraction } from "./Remove";

describe("<RemoveSubtraction />", () => {
  let props;
  let wrapper;

  it("renders correctly", () => {
    props = {
      router: { location: { state: { removeSubtraction: true } } },
      id: "123abc",
      onHide: jest.fn(),
      onConfirm: jest.fn()
    };
    wrapper = shallow(<RemoveSubtraction {...props} />);
    expect(wrapper).toMatchSnapshot();
  });

  describe("Dispatch Functions", () => {
    const initialState = {
      router: { location: { state: { removeSubtraction: true } } }
    };
    const store = mockStore(initialState);
    let spy;

    afterEach(() => {
      spy.restore();
    });

    it("Closing modal dispatches location state change", () => {
      spy = sinon.spy(actions, "removeSubtraction");
      expect(spy.called).toBe(false);

      wrapper = shallow(
        <RemoveSubtractionContainer store={store} id="123abc" />
      ).dive();
      wrapper.find({ id: "123abc" }).prop("onConfirm")();
      expect(spy.calledWith("123abc")).toBe(true);
    });

    it("Clicking delete button dispatches removeSubtraction() action", () => {
      spy = sinon.spy(store, "dispatch");
      expect(spy.called).toBe(false);

      wrapper = shallow(
        <RemoveSubtractionContainer store={store} id="123abc" />
      ).dive();
      wrapper.find({ id: "123abc" }).prop("onHide")();
      expect(
        spy.calledWith(push({ state: { removeSubtraction: false } }))
      ).toBe(true);
    });
  });
});
