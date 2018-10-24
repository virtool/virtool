import { ListGroupItem } from "../../../base";
import MemberEntry from "./MemberEntry";

describe("<MemberEntry />", () => {
  let props;
  let wrapper;

  beforeEach(() => {
    props = {
      id: "test",
      onEdit: sinon.spy(),
      onToggleSelect: sinon.spy()
    };
  });

  it("renders correctly with minimal props", () => {
    props = {
      ...props,
      add: false,
      isSelected: false
    };
    wrapper = shallow(<MemberEntry {...props} />);
    expect(wrapper).toMatchSnapshot();
  });

  it("renders correctly with all props", () => {
    props = {
      ...props,
      add: true,
      identicon: "randomhashof15c",
      permissions: { foo: false, bar: true },
      isSelected: true,
      onRemove: jest.fn()
    };
    wrapper = shallow(<MemberEntry {...props} />);
    expect(wrapper).toMatchSnapshot();
  });

  it("calls onToggleSelect callback on entry click", () => {
    wrapper = shallow(<MemberEntry {...props} />);
    expect(props.onToggleSelect.called).toBe(false);

    wrapper.find(".list-group-item").prop("onClick")();
    expect(props.onToggleSelect.calledWith(props.id)).toBe(true);
  });

  it("calls onRemove callback on trash icon click", () => {
    props = {
      ...props,
      onRemove: sinon.spy()
    };
    wrapper = shallow(<MemberEntry {...props} />);
    expect(props.onRemove.called).toBe(false);

    wrapper.find({ name: "trash" }).prop("onClick")();
    expect(props.onRemove.calledWith(props.id)).toBe(true);
  });

  it("calls onEdit callback on permissions entry click", () => {
    props = {
      ...props,
      permissions: { test: false },
      isSelected: true
    };
    wrapper = shallow(<MemberEntry {...props} />);
    expect(props.onEdit.called).toBe(false);

    wrapper.find(ListGroupItem).prop("onClick")();
    expect(props.onEdit.calledWith(props.id, "test", true)).toBe(true);
  });
});
