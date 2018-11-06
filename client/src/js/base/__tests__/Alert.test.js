import { Alert } from "../Alert";
import { Icon } from "../Icon";

describe("<Alert />", () => {
    let wrapper;

    it("renders correctly", () => {
        wrapper = shallow(<Alert />);

        expect(wrapper).toMatchSnapshot();

        wrapper = shallow(<Alert bsStyle="danger" className="tester" />);

        expect(wrapper).toMatchSnapshot();
    });

    it("renders an icon if supplied", () => {
        wrapper = shallow(<Alert icon="tester" />);
        expect(wrapper.find(Icon).exists()).toBe(true);
    });

    it("renders supplied children if icon is not supplied", () => {
        wrapper = shallow(
            <Alert>
                <div>Child Component</div>
            </Alert>
        );
        expect(wrapper.find("div").text()).toEqual("Child Component");
    });
});
