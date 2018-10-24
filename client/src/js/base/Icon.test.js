import { OverlayTrigger } from "react-bootstrap";
import { Icon } from "./Icon";

describe("<Icon />", () => {
  let props;
  let wrapper;

  it("renders correctly", () => {
    props = {
      name: "i-test"
    };
    wrapper = shallow(<Icon {...props} />);
    expect(wrapper).toMatchSnapshot();
  });

  it("adds 3px margin-left property when [props.pad=true]", () => {
    props = {
      name: "i-test",
      pad: true
    };

    wrapper = shallow(<Icon {...props} />);
    expect(wrapper.find("i").prop("style")).toEqual({ marginLeft: "3px" });
  });

  it("add bsStyle class when bsStyle prop is given and [prop.pending=false]", () => {
    props = {
      name: "i-test",
      bsStyle: "danger"
    };
    wrapper = shallow(<Icon {...props} />);

    expect(wrapper.find("i").hasClass(`text-${props.bsStyle}`)).toBe(true);
  });

  describe("when props.tip is supplied", () => {
    it("renders Tooltip + OverlayTrigger components", () => {
      props = {
        name: "i-test",
        tip: "test_tip"
      };
      wrapper = mount(
        <div>
          <Icon {...props} />
        </div>
      );

      expect(wrapper.find(OverlayTrigger).length).toEqual(1);

      const target = wrapper.find(OverlayTrigger).prop("overlay");

      expect(target.type.name).toEqual("Tooltip");
      expect(target.props.children).toEqual(props.tip);
    });

    it("renders accordingly to props.tipPlacement (if supplied)", () => {
      props = {
        name: "i-test",
        tip: "test tip",
        tipPlacement: "right"
      };

      wrapper = shallow(<Icon {...props} />);
      expect(wrapper.find(OverlayTrigger).prop("placement")).toEqual(
        props.tipPlacement
      );
    });
  });

  describe("when props.tip is not supplied", () => {
    it("renders <i> element", () => {
      props = {
        name: "i-test"
      };
      wrapper = shallow(<Icon {...props} />);

      expect(wrapper.length).toEqual(1);
      expect(wrapper.find("i").exists()).toBe(true);
    });

    it("is clickable if onClick is supplied", () => {
      props = {
        name: "i-test",
        onClick: jest.fn()
      };
      wrapper = shallow(<Icon {...props} />);

      wrapper.find("i").simulate("click", { stopPropagation: jest.fn() });

      expect(props.onClick).toHaveBeenCalled();
    });
  });
});
