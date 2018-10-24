import { Modal } from "react-bootstrap";
import { RemoveModal } from "./RemoveModal";
import { Button } from "./Button";

describe("<RemoveModal />", () => {
  let props;
  let wrapper;

  it("renders correctly", () => {
    wrapper = shallow(<RemoveModal />);
    expect(wrapper).toMatchSnapshot();
  });

  it("renders a bootstrap Modal component when [show=true]", () => {
    wrapper = shallow(<RemoveModal show={true} />);

    expect(wrapper.find(Modal).exists()).toBe(true);
    expect(wrapper).toMatchSnapshot();
  });

  it("renders Modal.Header, Modal.Body, Modal.Footer subcomponents", () => {
    wrapper = shallow(<RemoveModal show={true} />);

    expect(wrapper.find(Modal.Header).length).toEqual(1);
    expect(wrapper.find(Modal.Body).length).toEqual(1);
    expect(wrapper.find(Modal.Footer).length).toEqual(1);
  });

  it("clicking the close button results in calling the onHide prop function", () => {
    props = {
      show: true,
      onHide: jest.fn()
    };
    wrapper = mount(<RemoveModal {...props} />);

    wrapper
      .find("button")
      .at(0)
      .simulate("click");

    expect(props.onHide).toHaveBeenCalled();
  });

  it("Modal.Header displays the noun prop", () => {
    props = {
      noun: "test",
      show: true,
      onHide: jest.fn()
    };
    wrapper = shallow(<RemoveModal {...props} />);

    expect(
      wrapper
        .find(Modal.Header)
        .childAt(1)
        .text()
    ).toEqual(props.noun);
  });

  it("Modal.Body displays the name prop", () => {
    props = {
      name: "test-name",
      show: true,
      onHide: jest.fn()
    };
    wrapper = shallow(<RemoveModal {...props} />);

    expect(wrapper.find("strong").text()).toEqual(props.name);

    const message = (
      <span>
        Remove <strong>test-name-2</strong>
      </span>
    );
    wrapper = shallow(<RemoveModal {...props} message={message} />);

    expect(wrapper.find("strong").text()).toEqual("test-name-2");
  });

  it("Modal.Footer renders a confirmation button", () => {
    props = {
      show: true
    };
    wrapper = shallow(<RemoveModal {...props} />);

    expect(wrapper.find(Button).length).toEqual(1);
    expect(wrapper.find(Button)).toMatchSnapshot();
  });

  it("confirmation Button component calls the onClick prop function when clicked", () => {
    props = {
      show: true,
      onConfirm: jest.fn()
    };
    wrapper = shallow(<RemoveModal {...props} />);

    wrapper.find(Button).simulate("click");

    expect(props.onConfirm).toHaveBeenCalled();
  });
});
