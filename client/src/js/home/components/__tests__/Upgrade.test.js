import { Upgrade } from "../Upgrade";

describe("<Upgrade />", () => {
    it("should render 'no upgrade' message when [mongoVersion=3.6.3]", () => {
        const wrapper = shallow(<Upgrade mongoVersion="3.6.3" />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render 'upgrade required' message when [mongoVersion=3.2.1]", () => {
        const wrapper = shallow(<Upgrade mongoVersion="3.2.1" />);
        expect(wrapper).toMatchSnapshot();
    });
});
