import Subtraction, { SubtractionFileManager } from "./Subtraction";
import { StaticRouter } from "react-router-dom";
import FileManager from "../../files/components/Manager";
import { Switch, Route } from "react-router-dom";

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
