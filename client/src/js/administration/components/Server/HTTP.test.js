import { Checkbox, InputError } from "../../../base";
import * as actions from "../../actions";
import HTTPOptionsContainer, {
  HTTPOptions,
  HTTPFooter,
  HTTPCheckboxLabel
} from "./HTTP";

describe("<HTTPOptions />", () => {
  const initialState = {
    settings: {
      data: {
        server_host: "foo",
        server_port: "1",
        enable_api: true
      }
    }
  };
  const store = mockStore(initialState);
  let wrapper;

  it("renders correctly", () => {
    wrapper = shallow(<HTTPOptionsContainer store={store} />).dive();
    expect(wrapper).toMatchSnapshot();
  });

  it("renders HTTPCheckboxLabel correctly", () => {
    wrapper = shallow(<HTTPCheckboxLabel />);
    expect(wrapper).toMatchSnapshot();
  });

  it("renders HTTPFooter correctly", () => {
    wrapper = shallow(<HTTPFooter />);
    expect(wrapper).toMatchSnapshot();
  });

  it("renders HTTPOptions correctly", () => {
    const props = {
      onUpdateHost: jest.fn(),
      onUpdatePort: jest.fn(),
      onUpdateAPI: jest.fn(),
      host: "foo",
      port: "1",
      enableApi: false
    };
    wrapper = shallow(<HTTPOptions {...props} />);
    expect(wrapper).toMatchSnapshot();
  });

  describe("dispatch functions", () => {
    let spy;

    beforeAll(() => {
      spy = sinon.spy(actions, "updateSetting");
      wrapper = mount(<HTTPOptionsContainer store={store} />);
    });

    afterEach(() => {
      spy.resetHistory();
    });

    afterAll(() => {
      spy.restore();
    });

    it("Host input submit dispatches updateSetting() action to update 'server_host' field", () => {
      expect(spy.called).toBe(false);
      wrapper
        .find(InputError)
        .at(0)
        .prop("onSave")({ value: "bar" });
      expect(spy.calledWith("server_host", "bar")).toBe(true);
    });

    it("Port input submit dispatches updateSetting() action to update 'server_port' field", () => {
      expect(spy.called).toBe(false);
      wrapper
        .find(InputError)
        .at(1)
        .prop("onSave")({ value: "88" });
      expect(spy.calledWith("server_port", 88)).toBe(true);
    });

    it("Enable API checkbox toggle dispatches updateSetting() action to update 'enable_api' field", () => {
      expect(spy.called).toBe(false);
      wrapper.find(Checkbox).prop("onClick")();
      expect(spy.calledWith("enable_api", false)).toBe(true);
    });
  });
});
