import OTUGeneral from "./General";

describe("<OTUGeneral />", () => {
  let initialState = {
    otus: {
      detail: {
        abbreviation: "TV",
        id: "123abc",
        name: "test-virus",
        version: 3
      }
    }
  };
  let store;
  let wrapper;

  it("renders correctly with issues", () => {
    initialState = {
      otus: {
        detail: {
          ...initialState.otus.detail,
          issues: {
            empty_otu: false,
            empty_isolate: ["456def"],
            empty_sequence: false,
            isolate_inconsistency: false
          },
          isolates: [{ id: "456def" }]
        }
      }
    };
    store = mockStore(initialState);
    wrapper = shallow(<OTUGeneral store={store} />).dive();
    expect(wrapper).toMatchSnapshot();
  });

  it("renders correctly without issues", () => {
    initialState = {
      otus: {
        detail: {
          ...initialState.otus.detail,
          issues: null,
          isolates: []
        }
      }
    };
    store = mockStore(initialState);
    wrapper = shallow(<OTUGeneral store={store} />).dive();
    expect(wrapper).toMatchSnapshot();
  });
});
