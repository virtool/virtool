import { Identicon } from "../Identicon";

describe("<Identicon />", () => {
    const hash = "d3b07384d113edec49eaa6238ad5ff00";

    it("should render correctly", () => {
        const wrapper = shallow(<Identicon hash={hash} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with [size=24]", () => {
        const wrapper = shallow(<Identicon hash={hash} size={24} />);
        expect(wrapper).toMatchSnapshot();
    });
});
