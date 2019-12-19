import { mapStateToProps, UserPermissions } from "../Permissions";

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

describe("mapStateToProps", () => {
    const state = {
        users: {
            detail: {
                permissions: "foo"
            }
        }
    };
    it("should return props", () => {
        const result = mapStateToProps(state);
        expect(result).toEqual({
            permissions: "foo"
        });
    });
});
