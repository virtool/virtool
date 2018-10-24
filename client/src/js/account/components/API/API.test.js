import APIContainer from "./API";

describe("<API />", () => {
  let initialState;
  let store;
  let wrapper;

  const testRenderedOutput = initialState => {
    store = mockStore(initialState);
    wrapper = shallow(<APIContainer store={store} />).dive();
    expect(wrapper).toMatchSnapshot();
  };

  it("renders correctly with existing API keys", () => {
    initialState = {
      account: {
        apiKeys: [{ id: "test1" }, { id: "test2" }]
      }
    };
    testRenderedOutput(initialState);
  });

  it("renders correctly without API keys", () => {
    initialState = { account: { apiKeys: null } };
    testRenderedOutput(initialState);
  });

  it("renders correctly with 0 API keys", () => {
    initialState = { account: { apiKeys: [] } };
    testRenderedOutput(initialState);
  });
});
