import * as actions from "../../actions";
import { Button } from "../../../base";
import SentryOptionsContainer, { SentryFooter, SentryOptions } from "./Sentry";

describe("<Sentry />", () => {
  const initialState = { settings: { data: { enable_sentry: false } } };
  const store = mockStore(initialState);
  let wrapper;

  it("renders correctly", () => {
    wrapper = shallow(<SentryOptionsContainer store={store} />).dive();
    expect(wrapper).toMatchSnapshot();
  });

  it("renders SentryFooter correctly", () => {
    wrapper = shallow(<SentryFooter />);
    expect(wrapper).toMatchSnapshot();
  });

  it("renders SentryOptions correctly", () => {
    const props = {
      enabled: false,
      onToggle: jest.fn()
    };
    wrapper = shallow(<SentryOptions {...props} />);
    expect(wrapper).toMatchSnapshot();
  });

  it("dispatches updateSetting() action on checkbox toggle to update 'enable_sentry' field", () => {
    const spy = sinon.spy(actions, "updateSetting");
    expect(spy.called).toBe(false);

    wrapper = mount(<SentryOptionsContainer store={store} />);
    wrapper.find(Button).prop("onClick")();

    expect(spy.calledWith("enable_sentry", true)).toBe(true);

    spy.restore();
  });
});
