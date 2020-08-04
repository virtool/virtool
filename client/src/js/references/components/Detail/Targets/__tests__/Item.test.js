import { TargetItem } from "../Item";

describe("<TargetItem />", () => {
    let props;

    beforeEach(() => {
        props = {
            name: "foo",
            canModify: true,
            description: "bar",
            onEdit: jest.fn(),
            onRemove: jest.fn()
        };
    });

    it("should render when [canModify=true]", () => {
        const wrapper = shallow(<TargetItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [canModify=false]", () => {
        props.canModify = false;
        const wrapper = shallow(<TargetItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with no description", () => {
        props.description = "";
        const wrapper = shallow(<TargetItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should call onEdit when edit icon clicked", () => {
        const wrapper = shallow(<TargetItem {...props} />);
        wrapper.find("Icon").at(0).simulate("click");
        expect(props.onEdit).toHaveBeenCalledWith("foo");
    });

    it("should call onRemove when remove icon clicked", () => {
        const wrapper = shallow(<TargetItem {...props} />);
        wrapper.find("Icon").at(1).simulate("click");
        expect(props.onRemove).toHaveBeenCalledWith("foo");
    });
});
