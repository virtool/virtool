import { VTLogo } from "./Logo";

describe("<Logo />", () => {
  it("renders correctly", () => {
    const wrapper = shallow(<VTLogo />);
    expect(wrapper).toMatchSnapshot();
  });
});
