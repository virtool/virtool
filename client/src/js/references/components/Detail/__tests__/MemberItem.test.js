import { Icon } from "../../../../base";
import MemberItem from "../MemberItem";

describe("<MemberItem />", () => {
    let props;

    beforeEach(() => {
        props = {
            canModify: false,
            id: "bob",
            identicon: "6be6d0a72a16cb633144ec03cdaef77804c6f94770184f83e0899fe6bdcb77ee",
            onEdit: jest.fn(),
            onRemove: jest.fn()
        };
    });

    it("should render with identicon", () => {
        const wrapper = shallow(<MemberItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render without identicon", () => {
        props.identicon = undefined;
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
