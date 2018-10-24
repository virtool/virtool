import SampleDetailGeneral from "./General";

describe("<SampleDetailGeneral />", () => {
  let initialState = {
    samples: {
      detail: {
        id: "123abc",
        name: "test-name",
        host: "test-host",
        isolate: "test-isolate",
        locale: "test-locale",
        quality: {
          gc: 50,
          count: 100,
          encoding: "test",
          length: [0, 50, 100]
        },
        user: { id: "test-user" },
        subtraction: { id: "test-subtraction" }
      }
    }
  };
  let store;
  let wrapper;

  it("renders correctly with sRNA reads and paired read files", () => {
    initialState = {
      samples: {
        detail: {
          ...initialState.samples.detail,
          srna: true,
          paired: true,
          files: ["hello", "world"]
        }
      }
    };
    store = mockStore(initialState);
    wrapper = shallow(<SampleDetailGeneral store={store} />).dive();
    expect(wrapper).toMatchSnapshot();
  });

  it("renders correctly with normal reads and single read file", () => {
    initialState = {
      samples: {
        detail: {
          ...initialState.samples.detail,
          srna: false,
          paired: false,
          files: ["foobar"]
        }
      }
    };
    store = mockStore(initialState);
    wrapper = shallow(<SampleDetailGeneral store={store} />).dive();
    expect(wrapper).toMatchSnapshot();
  });
});
