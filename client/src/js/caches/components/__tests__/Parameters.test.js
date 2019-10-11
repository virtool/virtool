import CacheParameters from "../Parameters.js";

describe("<CacheParameters />", () => {
    const props = {
        parameters: "foo"
    };

    it("should render", () => {
        const wrapper = shallow(<CacheParameters {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should rander when [hash=null]", () => {
        props.parameters = null;
        const wrapper = shallow(<CacheParameters {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
