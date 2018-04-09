import { Identicon } from "./Identicon";

describe("<Identicon />", () => {
    const size = 64;
    const hash = "d3b07384d113edec49eaa6238ad5ff00";

    const wrapper = shallow(<Identicon size={size} hash={hash} />);

    it("renders correctly", () => {
        expect(wrapper).toMatchSnapshot();
    });

    it("renders an <img> element", () => {
        expect(wrapper.type()).toBe("img");
    });

});
