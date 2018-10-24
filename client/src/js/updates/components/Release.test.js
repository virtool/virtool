import { Col } from "react-bootstrap";
import Release, { ReleaseMarkdown } from "./Release";

describe("<Release />", () => {
  let props;
  let wrapper;

  it("renders correctly", () => {
    props = {
      body: "foo bar baz",
      name: "test",
      html_url: "www.github.com/virtool/virtool"
    };
    wrapper = shallow(<Release {...props} />);
    wrapper
      .find(Col)
      .at(1)
      .prop("onClick")();
    expect(wrapper).toMatchSnapshot();
  });

  it("renders <ReleaseMarkdown /> subcomponent", () => {
    props = { body: "hello world" };
    wrapper = shallow(<ReleaseMarkdown {...props} />);
    wrapper.setProps({ noMargin: true });
    expect(wrapper).toMatchSnapshot();
  });
});
