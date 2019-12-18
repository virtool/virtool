import { GroupPrimaryPermissions } from "../GroupPrimaryPermissions";

describe("<GroupPrimaryPermissions />", () => {
    it("should render", () => {
        const wrapper = shallow(<GroupPrimaryPermissions />);
        expect(wrapper).toMatchSnapshot();
    });
});
