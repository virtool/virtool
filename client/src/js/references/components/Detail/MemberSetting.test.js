import MemberSetting from "./MemberSetting";

describe("<MemberSetting />", () => {
  let props;
  let wrapper;

  it("renders correctly", () => {
    props = {
      noun: "test",
      listComponents: [],
      onAdd: jest.fn()
    };
    wrapper = shallow(<MemberSetting {...props} />);
    expect(wrapper).toMatchSnapshot();
  });
});
