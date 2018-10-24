import Jobs, { JobsSettings } from "./Jobs";

describe("<Jobs />", () => {
  let initialState;
  let store;
  let wrapper;

  it("renders correctly", () => {
    initialState = { settings: { data: {} } };
    store = mockStore(initialState);
    wrapper = shallow(<Jobs store={store} />).dive();
    expect(wrapper).toMatchSnapshot();
  });

  it("renders <LoadingPlaceholder /> if settings data is unavailable", () => {
    initialState = { settings: { data: null } };
    store = mockStore(initialState);
    wrapper = shallow(<Jobs store={store} />).dive();
    expect(wrapper).toMatchSnapshot();
  });

  it("renders <JobsSettings /> subcomponent", () => {
    wrapper = shallow(<JobsSettings />);
    expect(wrapper).toMatchSnapshot();
  });
});
