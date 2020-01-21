import { RIDTiming } from "../BLASTInProgress";

describe("<RIDTiming>", () => {
    const props = {
        interval: 30,
        lastCheckedAt: "2019-02-10T17:11:00.000000Z"
    };

    const RealDate = Date;

    beforeAll(() => {
        Date.now = jest.fn(() => new Date("2019-02-10T17:11:23.000000Z"));
    });

    it("should render", () => {
        const wrapper = shallow(<RIDTiming {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    afterAll(() => {
        Date = RealDate;
    });
});
