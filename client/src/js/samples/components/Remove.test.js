import * as actions from "../actions";
import RemoveSample from "./Remove";

describe("<Remove />", () => {
  const initialState = { samples: { showRemove: true } };
  const store = mockStore(initialState);
  const props = {
    id: "123abc",
    name: "test",
    onHide: jest.fn(),
    onConfirm: jest.fn()
  };
  const wrapper = shallow(<RemoveSample store={store} {...props} />).dive();

  it("renders correctly", () => {
    expect(wrapper).toMatchSnapshot();
  });

  it("Clicking button dispatches removeSample() actions", () => {
    const spy = sinon.spy(actions, "removeSample");
    expect(spy.called).toBe(false);

    wrapper.prop("onConfirm")();
    expect(spy.calledWith("123abc")).toBe(true);

    spy.restore();
  });
});
