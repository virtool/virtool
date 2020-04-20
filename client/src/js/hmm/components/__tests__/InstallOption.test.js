jest.mock("../../../utils/utils");
import { InstallOption, mapStateToProps, mapDispatchToProps } from "../InstallOption";
import { checkAdminOrPermission } from "../../../utils/utils";

describe("<InstallOption />", () => {
    let props;
    beforeEach(() => {
        props = {
            canInstall: true,
            releaseId: "foo"
        };
    });

    it("should render button when [canInstall=true]", () => {
        const wrapper = shallow(<InstallOption {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should render permission alert when [canInstall=false]", () => {
        props.canInstall = false;
        const wrapper = shallow(<InstallOption {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps", () => {
    const state = {
        hmms: {
            status: {
                release: {
                    id: "foo"
                }
            }
        },
        account: {
            administrator: false,
            permissions: { modify_hmm: true }
        }
    };
    it("should return props", () => {
        checkAdminOrPermission.mockReturnValue(true);
        const props = mapStateToProps(state);
        expect(props).toEqual({
            canInstall: true,
            releaseId: "foo"
        });
        expect(checkAdminOrPermission).toHaveBeenCalledWith(state, "modify_hmm");
    });
});

describe("mapDispatchToProps", () => {
    it("should return onInstall in props", () => {
        const dispatch = jest.fn();
        const releaseId = "foo";
        const props = mapDispatchToProps(dispatch);
        props.onInstall(releaseId);
        expect(dispatch).toHaveBeenCalledWith({
            release_id: "foo",
            type: "INSTALL_HMMS_REQUESTED"
        });
    });
});
