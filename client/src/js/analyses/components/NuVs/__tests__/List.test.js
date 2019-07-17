import { NuVsList } from "../List";

describe("<NuVsList />", () => {
    it("should render", () => {
        const props = {
            shown: 4,
            total: 10
        };
        const wrapper = shallow(<NuVsList {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
