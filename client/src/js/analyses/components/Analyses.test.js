import { MemoryRouter, Route } from "react-router";
import * as actions from "../actions";
import AnalysesContainer from "./Analyses";

describe("<Analyses />", () => {
  const store = mockStore({});
  let spy;
  let wrapper;

  it("renders correctly", () => {
    wrapper = shallow(
      <AnalysesContainer
        store={store}
        analyses={null}
        match={{ params: { sampleId: "hello" } }}
      />
    ).dive();
    expect(wrapper).toMatchSnapshot();

    wrapper = shallow(
      <AnalysesContainer
        store={store}
        analyses={[]}
        match={{ params: { sampleId: "world" } }}
      />
    ).dive();
    expect(wrapper).toMatchSnapshot();
  });

  it("Component on mount dispatches findAnalyses() action to fetch analyses list", () => {
    spy = sinon.spy(actions, "findAnalyses");
    expect(spy.called).toBe(false);

    wrapper = mount(
      <MemoryRouter initialEntries={["/samples/test-sample"]}>
        <Route
          component={({ match }) => (
            <AnalysesContainer store={store} match={match} />
          )}
          path="/samples/:sampleId"
        />
      </MemoryRouter>
    );

    expect(spy.calledWith("test-sample")).toBe(true);
    spy.restore();
  });
});
