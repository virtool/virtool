import { TargetForm } from "../Form";

describe("<TargetForm />", () => {
    const props = {
        onChange: jest.fn(),
        name: "foo",
        description: "bar",
        length: 1,
        required: false,
        onClick: jest.fn()
    };

    it("should render", () => {
        const wrapper = shallow(<TargetForm {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
