import Indexes from "../Indexes";

describe("<Indexes />", () => {
    it("should render", () => {
        const wrapper = shallow(<Indexes />);
        expect(wrapper).toMatchSnapshot();
    });
});
