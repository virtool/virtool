import Indexes from "./Indexes";

describe("<Indexes />", () => {

    it("renders correctly", () => {
        const wrapper = shallow(<Indexes />);

        expect(wrapper).toMatchSnapshot();
    });

});
