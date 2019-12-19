jest.mock("../../selectors");

import { getCanModifyUser } from "../../selectors";
import { UserRole, mapStateToProps } from "../Role";

describe("<UserRole />", () => {
    let props;

    beforeEach(() => {
        props = {
            canModifyUser: true,
            id: "bob",
            role: "administrator",
            onSetUserRole: jest.fn()
        };
    });

    it.each(["administrator", "limited"])("should render when [role=%p]", role => {
        props.role = role;
        const wrapper = shallow(<UserRole {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render empty when [canModifyUser=false]", () => {
        props.canModifyUser = false;
        const wrapper = shallow(<UserRole {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onSetUserRole() when selection changes", () => {
        const wrapper = shallow(<UserRole {...props} />);
        wrapper.find("InputError").prop("onChange")({ target: { value: "limited" } });
        expect(props.onSetUserRole).toHaveBeenCalledWith("bob", "limited");
    });
});

describe("mapStateToProps()", () => {
    let state;

    beforeEach(() => {
        state = {
            users: {
                detail: {
                    administrator: true,
                    id: "bob"
                }
            }
        };
    });

    it.each([true, false])("should return props when [administrator=%p]", administrator => {
        state.users.detail.administrator = administrator;
        getCanModifyUser.mockReturnValue(true);
        const props = mapStateToProps(state);
        expect(props).toEqual({
            canModifyUser: true,
            id: "bob",
            role: administrator ? "administrator" : "limited"
        });
    });

    it.each([true, false])("should return props when [canModifyUser=%p]", canModifyUser => {
        getCanModifyUser.mockReturnValue(canModifyUser);
        const props = mapStateToProps(state);
        expect(props).toEqual({
            canModifyUser,
            id: "bob",
            role: "administrator"
        });
    });
});
