import Subtraction, { SubtractionFileManager } from "../Subtraction";

describe("<SubtractionFileManager />", () => {
    it("should render", () => {
        const wrapper = shallow(<SubtractionFileManager />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<Subtraction />", () => {
    it("should render", () => {
        const wrapper = shallow(<Subtraction />);
        expect(wrapper).toMatchSnapshot();
    });
});
