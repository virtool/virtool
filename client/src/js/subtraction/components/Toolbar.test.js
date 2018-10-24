import SubtractionToolbar from "./Toolbar";

describe("<SubtractionToolbar />", () => {
  let props;
  let wrapper;

  it("renders correctly when [canModify=true]", () => {
    props = {
      term: "test",
      onFilter: jest.fn(),
      canModify: true
    };
    wrapper = shallow(<SubtractionToolbar {...props} />);
    expect(wrapper).toMatchSnapshot();
  });

  it("renders correctly when [canModify=false]", () => {
    props = {
      term: "test",
      onFilter: jest.fn(),
      canModify: false
    };
    wrapper = shallow(<SubtractionToolbar {...props} />);
    expect(wrapper).toMatchSnapshot();
  });
});
