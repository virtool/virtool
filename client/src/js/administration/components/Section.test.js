import AdministrationSection from "./Section";
import { Icon } from "../../base";

describe("<AdministrationSection />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        props = {
            title: "test",
            description: "example",
            content: <div>Foo</div>
        };
        wrapper = shallow(<AdministrationSection {...props} />);

        expect(wrapper).toMatchSnapshot();
    });

    it("renders correctly with optional icon and footer elements", () => {
        props = {
            extraIcon: <Icon name="check" />,
            footerComponent: <div>Bar</div>,
            title: "test",
            description: "example",
            content: <div>Foo</div>
        };
        wrapper = shallow(<AdministrationSection {...props} />);

        expect(wrapper).toMatchSnapshot();
    });

});
