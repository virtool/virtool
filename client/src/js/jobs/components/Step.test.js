import JobStep from "./Step";

describe("<JobStep />", () => {
  let props;
  let wrapper;

  it("renders Running step", () => {
    props = {
      step: { state: "running", stage: "test" },
      isDone: false
    };
    wrapper = shallow(<JobStep {...props} />);
    expect(wrapper.find({ size: "14px" }).length).toEqual(1);

    wrapper.setProps({ isDone: true });
    expect(wrapper.find({ name: "check fa-fw" }).length).toEqual(1);
    expect(wrapper).toMatchSnapshot();
  });

  it("renders Complete step", () => {
    props = { step: { state: "complete", stage: "test" } };
    wrapper = shallow(<JobStep {...props} />);
    expect(wrapper).toMatchSnapshot();
  });

  it("renders Error step", () => {
    props = { step: { state: "error", stage: "test" } };
    wrapper = shallow(<JobStep {...props} />);
    expect(wrapper).toMatchSnapshot();
  });

  it("renders Cancelled step", () => {
    props = { step: { state: "cancelled", stage: "test" } };
    wrapper = shallow(<JobStep {...props} />);
    expect(wrapper).toMatchSnapshot();
  });

  it("otherwise returns null", () => {
    props = { step: { state: "", stage: "" } };
    wrapper = shallow(<JobStep {...props} />);
    expect(wrapper.html()).toBeNull();
  });
});
