import { ListGroupItem } from "../../../base/index";
import APIPermissions from "./Permissions";

describe("<Permissions />", () => {
  let props;
  let wrapper;

  beforeAll(() => {
    props = {
      userPermissions: {
        test_create: true,
        test_edit: true,
        test_remove: false,
        test_view: false
      },
      keyPermissions: {
        test_create: true,
        test_edit: false,
        test_remove: true,
        test_view: false
      },
      onChange: jest.fn()
    };
    wrapper = shallow(<APIPermissions {...props} />);
  });

  it("renders correctly", () => {
    expect(wrapper).toMatchSnapshot();
  });

  it("clicking invokes onChange callback", () => {
    wrapper
      .find(ListGroupItem)
      .at(1)
      .simulate("click");
    expect(props.onChange).toHaveBeenCalled();
  });
});
