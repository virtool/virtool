import UserPermissions from "./Permissions";

describe("<UserPermissions />", () => {
  it("renders correctly", () => {
    const props = {
      permissions: {
        test_create: true,
        test_delete: false
      }
    };
    const wrapper = shallow(<UserPermissions {...props} />);

    expect(wrapper).toMatchSnapshot();
  });
});
