import { RelativeTime } from "../RelativeTime";

const RealDate = Date;

describe("<RelativeTime />", () => {
    let props;

    beforeEach(() => {
        props = {
            time: "2019-02-10T17:11:00.000000Z"
        };
    });

    beforeAll(() => {
        Date.now = jest.fn(() => new Date("2019-04-22T10:20:30Z"));
    });

    it("should render", () => {
        // formatDistanceStrict.mockReturnValue("2 days ago");
        // Date.now = jest.fn(() => new Date("2019-04-22T10:20:30Z"));
        const wrapper = shallow(<RelativeTime {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("componentDidMount() should update this.interval", () => {
        const wrapper = shallow(<RelativeTime {...props} />);
        expect(wrapper.instance().interval).toBe(9);
    });

    it("componentDidUpdate() should update timeString when [prevProps.time !== this.props.time] and [newTimeString !== this.state.timeString]", () => {
        const wrapper = shallow(<RelativeTime {...props} />);
        const time = "2019-01-10T12:21:00.000000Z";

        wrapper.setProps({ ...props, time });

        expect(wrapper.state()).toEqual({
            time,
            timeString: "3 months ago"
        });
    });

    it("componentDidUpdate() should not call update when [prevProps.time === this.props.time]", () => {
        const wrapper = shallow(<RelativeTime {...props} />);
        wrapper.setProps({ ...props, time: "2020-02-14T17:12:00.000000Z" });
        wrapper.instance().update = jest.fn();
        expect(wrapper.instance().update).not.toHaveBeenCalled();
    });

    it("componentWillUnmount() should update this.interval", () => {
        const wrapper = shallow(<RelativeTime {...props} />);
        wrapper.instance().interval = 14;
        window.clearInterval = jest.fn();
        wrapper.unmount();
        expect(window.clearInterval).toHaveBeenCalledWith(14);
    });

    afterAll(() => {
        Date = RealDate;
    });
});
