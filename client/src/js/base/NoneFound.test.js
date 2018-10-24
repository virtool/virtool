import { ListGroup, ListGroupItem } from "react-bootstrap";
import { NoneFound } from "./NoneFound";
import { Icon } from "./Icon";

describe("<NoneFound />", () => {
  let wrapper;

  it("renders an info Icon component", () => {
    const noun = "test";

    wrapper = shallow(<NoneFound noun={noun} />);

    expect(wrapper.find(Icon).exists()).toBe(true);
    expect(wrapper.find(Icon).prop("name")).toEqual("info-circle");
    expect(wrapper).toMatchSnapshot();
  });

  describe("when supplied [noListGroup=false] prop", () => {
    const noun = "test";
    const noListGroup = false;

    beforeEach(() => {
      wrapper = shallow(<NoneFound noun={noun} noListGroup={noListGroup} />);
    });

    it("renders correctly", () => {
      expect(wrapper).toMatchSnapshot();
    });

    it("renders a ListGroup", () => {
      expect(wrapper.find(ListGroup).exists()).toBe(true);

      const message =
        wrapper
          .find(ListGroupItem)
          .childAt(1)
          .text() +
        wrapper
          .find(ListGroupItem)
          .childAt(2)
          .text() +
        wrapper
          .find(ListGroupItem)
          .childAt(3)
          .text();
      expect(message).toEqual(` No ${noun} found`);
    });
  });

  describe("when supplied [noListGroup=true] prop", () => {
    const noun = "test";
    const noListGroup = true;

    beforeEach(() => {
      wrapper = shallow(<NoneFound noun={noun} noListGroup={noListGroup} />);
    });

    it("renders correctly", () => {
      expect(wrapper).toMatchSnapshot();
    });

    it("renders a ListGroupItem without ListGroup container", () => {
      expect(wrapper.find(ListGroupItem).exists()).toBe(true);
    });
  });
});
