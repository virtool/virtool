import OTUItem from "./Item";

describe("<OTUItem />", () => {
  let initialState;
  let store;
  let props;
  let wrapper;

  it("renders correctly when [verified=false]", () => {
    initialState = {
      otus: {
        documents: [
          {
            id: "test-1",
            verified: false,
            name: "test-otu-1",
            abbreviation: "TO1"
          }
        ]
      }
    };
    store = mockStore(initialState);

    props = { index: 0, refId: "123abc" };
    wrapper = shallow(<OTUItem store={store} {...props} />).dive();
    expect(wrapper).toMatchSnapshot();
  });

  it("renders correctly when [verified=true]", () => {
    initialState = {
      otus: {
        documents: [
          {
            id: "test-2",
            verified: true,
            name: "test-otu-2",
            abbreviation: "TO2"
          }
        ]
      }
    };
    store = mockStore(initialState);

    props = { index: 0, refId: "123abc" };
    wrapper = shallow(<OTUItem store={store} {...props} />).dive();
    expect(wrapper).toMatchSnapshot();
  });
});
