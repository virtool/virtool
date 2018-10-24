import SequenceField from "./SequenceField";

describe("<SequenceField />", () => {
  let props;
  let wrapper;

  it("renders correctly", () => {
    props = {
      sequence: "ACTG",
      readOnly: false,
      onChange: jest.fn(),
      error: ""
    };
    wrapper = shallow(<SequenceField {...props} />);
    expect(wrapper).toMatchSnapshot();
  });
});
