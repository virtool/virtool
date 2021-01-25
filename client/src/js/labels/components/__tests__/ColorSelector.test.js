import { ColorSelector } from "../ColorSelector";

describe("<ColorSelector>", () => {
    it("should render", () => {
        const wrapper = shallow(<ColorSelector />);
        expect(wrapper).toMatchSnapshot();
    });
});
