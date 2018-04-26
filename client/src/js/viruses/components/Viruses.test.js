import Viruses from "./Viruses";

describe("<Viruses />", () => {

    it("renders correctly", () => {
        const wrapper = shallow(<Viruses />);

        expect(wrapper).toMatchSnapshot();
    });

});
