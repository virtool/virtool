import Subtraction, { SubtractionFileManager } from "./Subtraction";

describe("<Subtraction />", () => {
    it("renders correctly", () => {
        const wrapper = shallow(<Subtraction />);

        expect(wrapper).toMatchSnapshot();
    });

    it("renders a FileManager component with [filetype='subtraction']", () => {
        const wrapper = shallow(<SubtractionFileManager />);

        expect(wrapper).toMatchSnapshot();
    });
});
