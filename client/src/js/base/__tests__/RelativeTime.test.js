import Moment from "moment";
import { RelativeTime } from "../RelativeTime";

describe("<RelativeTime />", () => {
    let props;

    beforeEach(() => {
        props = {
            time: "2020-02-14T17:12:00.000000Z"
        };
    });

    it("should render", () => {
        const wrapper = shallow(<RelativeTime {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("componentDidMount() should update this.interval", () => {
        const wrapper = shallow(<RelativeTime {...props} />);
        expect(wrapper.instance().interval).toBe(7);
    });

    it("componentDidUpdate() should update timeString when [prevProps.time !== this.props.time] and [newTimeString !== this.state.timeString]", () => {
        const wrapper = shallow(<RelativeTime {...props} />);
        wrapper.setProps({ ...props, time: "2019-02-14T17:12:00.000000Z" });
        expect(wrapper.state()).toEqual({
            time: "2019-02-14T17:12:00.000000Z",
            timeString: "a year ago"
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
});
