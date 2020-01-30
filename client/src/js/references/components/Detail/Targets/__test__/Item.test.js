import { TargetItem } from "../Item";

describe("<TargetItem />", () => {
    const props = {
        name: "foo",
        description: "bar",
        onEdit: jest.fn(),
        onRemove: jest.fn()
    };

    it("should render", () => {
        const wrapper = shallow(<TargetItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
