import { Icon } from "../../../../base";
import MemberItem from "../MemberItem";

describe("<MemberItem />", () => {
    let props;

    beforeEach(() => {
        props = {
            canModify: false,
            id: "bob",
            onEdit: jest.fn(),
            onRemove: jest.fn()
        };
    });

    it("should render", () => {
        const wrapper = shallow(<MemberItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with [canModify=true]", () => {
        props.canModify = true;
        const wrapper = shallow(<MemberItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onEdit when edit icon is clicked", () => {
        props.canModify = true;
        const wrapper = shallow(<MemberItem {...props} />);

        // Get the edit (pencil) icon node and simulate a click on it.
        const icon = wrapper.find(Icon).findWhere(n => n.prop("name") === "edit");
        icon.simulate("click");

        expect(props.onEdit).toHaveBeenCalledWith(props.id);
    });

    it("should call onRemove when trash icon is clicked", () => {
        props.canModify = true;
        const wrapper = shallow(<MemberItem {...props} />);

        // Get the edit (pencil) icon node and simulate a click on it.
        const icon = wrapper.find(Icon).findWhere(n => n.prop("name") === "trash");
        icon.simulate("click");

        expect(props.onRemove).toHaveBeenCalledWith(props.id);
    });
});
