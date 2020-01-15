import { RIDTiming } from "../BLASTInProgress";

describe("<RIDTiming>", () => {
    const props = {
        interval: 10,
        lastCheckedAt: "2019-02-10T17:11:00.000000Z"
    };
    it("should render", () => {
        const wrapper = shallow(<RIDTiming {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
