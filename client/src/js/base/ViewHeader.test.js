import { Badge } from "react-bootstrap";
import { ViewHeader } from "./ViewHeader";

describe("<ViewHeader />", () => {
  let wrapper;

  it("renders correctly an html <head><title> element", () => {
    wrapper = shallow(<ViewHeader title="tester" />);

    expect(wrapper.find("title").text()).toEqual("tester");
    expect(wrapper).toMatchSnapshot();
  });

  it("renders visible <h3> title and supplied total count", () => {
    wrapper = shallow(<ViewHeader title="test-title" totalCount={10} />);

    expect(wrapper.find("strong").text()).toEqual("test-title");
    expect(
      wrapper
        .find(Badge)
        .children()
        .text()
    ).toEqual("10");
  });

  it("renders children if supplied", () => {
    wrapper = shallow(
      <ViewHeader title="test-child">
        <div>Tester</div>
      </ViewHeader>
    );

    expect(wrapper.find("div").text()).toEqual("Tester");
  });
});
