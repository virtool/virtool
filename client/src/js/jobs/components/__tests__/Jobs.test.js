import { Jobs } from "../Jobs";

describe("<Jobs />", () => {
    it("should render placeholder when loading", () => {
        const wrapper = shallow(<Jobs loading={true} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when loaded", () => {
        const wrapper = shallow(<Jobs loading={false} />);
        expect(wrapper).toMatchSnapshot();
    });
});
