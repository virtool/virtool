import * as actions from "../actions";
import JobsToolbar from "./Toolbar";

describe("<JobsToolbar />", () => {
  const initialState = { jobs: { filter: "test" } };
  const store = mockStore(initialState);
  let wrapper;

  it("renders correctly", () => {
    wrapper = shallow(<JobsToolbar store={store} />).dive();
    expect(wrapper).toMatchSnapshot();
  });

  describe("Dispatch Functions", () => {
    let spy;

    afterEach(() => {
      spy.restore();
    });

    it("Search input change dispatches filterJobs() action", () => {
      spy = sinon.spy(actions, "filterJobs");
      expect(spy.called).toBe(false);

      wrapper = mount(<JobsToolbar store={store} canRemove={false} />);

      wrapper
        .find({ value: "test" })
        .at(0)
        .prop("onChange")({ target: { value: "search" } });
      expect(spy.calledWith("search")).toBe(true);
    });

    it("Selecting a clear option dispatches clearJobs() action", () => {
      spy = sinon.spy(actions, "clearJobs");
      expect(spy.called).toBe(false);

      wrapper = mount(<JobsToolbar store={store} canRemove={true} />);

      wrapper.find({ eventKey: "removeFailed" }).prop("onClick")({
        target: { name: "failed" }
      });
      expect(spy.calledWith("failed")).toBe(true);
    });
  });
});
