import { RemoveBanner } from "../../../base";
import * as actions from "../../actions";
import RemoveReference from "./RemoveReference";

describe("<RemoveReference />", () => {
  const initialState = {
    references: {
      detail: {
        id: "test"
      }
    }
  };
  const store = mockStore(initialState);
  const props = { onConfirm: jest.fn() };
  let wrapper;

  it("renders correctly", () => {
    wrapper = shallow(<RemoveReference store={store} {...props} />).dive();
    expect(wrapper).toMatchSnapshot();
  });

  it("Clicking Delete button dispatches removeReference() action", () => {
    const spy = sinon.spy(actions, "removeReference");
    expect(spy.called).toBe(false);

    wrapper = mount(<RemoveReference store={store} {...props} />);

    wrapper.find(RemoveBanner).prop("onClick")();
    expect(spy.calledWith("test")).toBe(true);

    spy.restore();
  });
});
