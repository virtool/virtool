import { ListGroupItem } from "../../../../base/index";
import { APIPermissions } from "../Permissions";

describe("<Permissions />", () => {
    let props;

    beforeEach(() => {
        props = {
            administrator: false,
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
    });

    it("should render correctly", () => {
        const wrapper = shallow(<APIPermissions {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render no permission disabled when [props.administrator=true]", () => {
        props.administrator = true;
        const wrapper = shallow(<APIPermissions {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onChange when permission clicked", () => {
        const wrapper = shallow(<APIPermissions {...props} />);
        wrapper
            .find(ListGroupItem)
            .at(1)
            .simulate("click");
        expect(props.onChange).toHaveBeenCalled();
    });
});
