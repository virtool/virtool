import { ListGroupItem } from "../../../../base/index";
import { APIPermissions } from "../Permissions";

describe("<Permissions />", () => {
    let props;
    let wrapper;

    beforeEach(() => {
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

    it("should render correctly", () => {
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onChange when permission clicked", () => {
        wrapper
            .find(ListGroupItem)
            .at(1)
            .simulate("click");
        expect(props.onChange).toHaveBeenCalled();
    });
});
