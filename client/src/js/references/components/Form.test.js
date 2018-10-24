import ReferenceForm from "./Form";

describe("<ReferenceForm />", () => {
  let props = {
    state: {
      name: "test",
      description: "test-description",
      dataType: "test-datatype",
      organism: "test-organism",
      onChange: jest.fn(),
      errorName: "",
      errorDataType: ""
    }
  };
  let wrapper;

  it("renders correctly without errors", () => {
    props = {
      state: {
        ...props.state,
        errorFile: null,
        errorSelect: null
      }
    };
    wrapper = shallow(<ReferenceForm {...props} />);
    expect(wrapper).toMatchSnapshot();
  });

  it("renders correctly with errors", () => {
    props = {
      state: {
        ...props.state,
        errorFile: null,
        errorSelect: "Error Select"
      }
    };
    wrapper = shallow(<ReferenceForm {...props} />);
    expect(wrapper).toMatchSnapshot();
  });
});
