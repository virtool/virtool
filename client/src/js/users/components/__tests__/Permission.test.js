import { PermissionItem } from "../Permission";

describe("<PermissionItem />", () => {
    let props;
    beforeEach(() => {
        props = {
            acc: [],
            value: "foo",
            permission: { foo: "bar" }
        };
    });

    it("should render", () => {
        const wrapper = shallow(<PermissionItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
