import References, { ReferenceSettings } from "./References";

describe("<References />", () => {
  let initialState;
  let store;
  let wrapper;

  it("renders correctly with settings data", () => {
    initialState = {
      settings: {
        data: { foo: true, bar: false }
      }
    };
    store = mockStore(initialState);
    wrapper = shallow(<References store={store} />).dive();
    expect(wrapper).toMatchSnapshot();
  });

  it("renders <LoadingPlaceholder /> when no settings data available", () => {
    initialState = { settings: { data: null } };
    store = mockStore(initialState);
    wrapper = shallow(<References store={store} />).dive();
    expect(wrapper).toMatchSnapshot();
  });

  it("renders <ReferenceSettings /> correctly", () => {
    wrapper = shallow(<ReferenceSettings />);
    expect(wrapper).toMatchSnapshot();
  });
});
