import { push } from "react-router-redux";
import { Button } from "../../base";
import OTUToolbarContainer from "./Toolbar";

describe("<OTUToolbar />", () => {
  const initialState = {
    router: {
      location: {
        search: "test-search"
      }
    },
    references: {
      detail: {}
    }
  };
  const store = mockStore(initialState);
  let props;
  let wrapper;

  it("renders correctly", () => {
    props = { hasRemoveOTU: true };
    wrapper = shallow(<OTUToolbarContainer store={store} {...props} />).dive();
    expect(wrapper).toMatchSnapshot();
  });

  describe("dispatch functions", () => {
    let spy;

    beforeAll(() => {
      spy = sinon.spy(store, "dispatch");
    });

    afterEach(() => {
      spy.resetHistory();
    });

    afterAll(() => {
      spy.restore();
    });

    it("Change in input field dispatches router location change", () => {
      expect(spy.called).toBe(false);

      props = { hasRemoveOTU: false };
      wrapper = mount(<OTUToolbarContainer store={store} {...props} />);
      wrapper.find("input").prop("onChange")({ target: { value: "test" } });

      expect(spy.calledWith(push("/?find=test"))).toBe(true);
    });

    it("Click on filter button dispatches router location change to toggle", () => {
      expect(spy.called).toBe(false);

      props = { hasRemoveOTU: false };
      wrapper = mount(<OTUToolbarContainer store={store} {...props} />);
      wrapper.find(Button).prop("onClick")();
      expect(spy.calledWith(push("/?verified=false"))).toBe(true);

      window.history.pushState({}, "Test Filter Url", "/?verified=false");
      wrapper.find(Button).prop("onClick")();
      expect(spy.calledWith(push("/"))).toBe(true);

      window.history.pushState({}, "Reset Url", "/");
    });
  });
});
