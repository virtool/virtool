import UserPermissions from "../Permissions";

describe("<UserPermissions />", () => {
    let props;
    beforeEach(() => {
        props = {
            premissions: {
                test_create: true,
                test_delete: false
            }
        };
    });

    it("should render", () => {
        const wrapper = shallow(<UserPermissions {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
