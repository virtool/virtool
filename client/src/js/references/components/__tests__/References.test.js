import { References, ReferenceSettings } from "../References";

describe("<ReferenceSettings />", () => {
    it("should render", () => {
        const wrapper = shallow(<ReferenceSettings />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<References />", () => {
    it.each([true, false])("should render when [loading=%p]", loading => {
        const wrapper = shallow(<References loading={loading} />);
        expect(wrapper).toMatchSnapshot();
    });
});
