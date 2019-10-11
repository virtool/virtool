import CacheGeneral from "../General.js";

describe("<CacheGeneral />", () => {
    it("should render", () => {
        const props = {
            hash: "foo",
            program: "bar"
        };
        const wrapper = shallow(<CacheGeneral {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
