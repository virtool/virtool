import { Identicon } from "./Identicon";

describe("<Identicon />", () => {
    const hash = "d3b07384d113edec49eaa6238ad5ff00";

    const wrapper = shallow(<Identicon hash={hash} />);

    it("renders correctly", () => {
        expect(wrapper).toMatchSnapshot();
    });

    it("renders an <img> element", () => {
        expect(wrapper.type()).toBe("img");
    });
});
