import { Clone } from "../Clone";

describe("<Clone />", () => {
    const props = {
        source: {
            id: "foo",
            name: "bar"
        }
    };

    it("should render", () => {
        const wrapper = shallow(<Clone {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
