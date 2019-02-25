import OTUs from "../OTUs";

describe("<OTUs />", () => {
    it("should render", () => {
        const wrapper = shallow(<OTUs />);
        expect(wrapper).toMatchSnapshot();
    });
});
