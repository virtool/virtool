import JobError from "./Error";

describe("<JobError />", () => {
  let props;
  let wrapper;

  it("renders correctly with error details", () => {
    props = {
      error: {
        type: "TestErrorWithStackTrace",
        traceback: ["line one", "line two", "line three"],
        details: "test error details"
      }
    };
    wrapper = shallow(<JobError {...props} />);
    expect(wrapper).toMatchSnapshot();
  });

  it("renders correctly without error details", () => {
    props = {
      error: {
        type: "TestErrorWithoutStackTrace",
        traceback: [],
        details: ""
      }
    };
    wrapper = shallow(<JobError {...props} />);
    expect(wrapper).toMatchSnapshot();
  });

  it("returns null if no error supplied", () => {
    wrapper = shallow(<JobError />);
    expect(wrapper.html()).toBeNull();
  });
});
