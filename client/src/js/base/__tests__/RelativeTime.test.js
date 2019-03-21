import Moment from "moment";
import { RelativeTime } from "../RelativeTime";

describe("<RelativeTime />", () => {
    let props;
    let wrapper;
    let expected;

    it("renders correctly", () => {
        const pastTime = `${Moment()
            .subtract(60, "day")
            .toDate()
            .toISOString()}`;
        props = { time: pastTime };
        wrapper = shallow(<RelativeTime {...props} />);

        expected = Moment(props.time).fromNow();

        expect(wrapper.text()).toEqual(expected);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders 'just now' for browser lag future times", () => {
        const futureTime = `${Moment()
            .add(30, "seconds")
            .toDate()
            .toISOString()}`;
        props = { time: futureTime };
        wrapper = shallow(<RelativeTime {...props} />);

        expect(wrapper.text()).toEqual("just now");
        expect(wrapper).toMatchSnapshot();
    });

    it("sets and clears interval in componentDidMount and componentWillUnmount respectively", () => {
        const spySetInterval = sinon.spy(window, "setInterval");
        const spyClearInterval = sinon.spy(window, "clearInterval");

        props = {
            time: "2018-02-14T17:12:00.000000Z"
        };
        wrapper = mount(<RelativeTime {...props} />);

        expect(spySetInterval.calledOnce).toBe(true);
        expect(spyClearInterval.called).toBe(false);

        wrapper.unmount();

        expect(spyClearInterval.calledOnce).toBe(true);

        spySetInterval.restore();
        spyClearInterval.restore();
    });

    describe("when receiving new time prop:", () => {
        let spySCU;
        let spyCDU;

        beforeAll(() => {
            spySCU = sinon.spy(RelativeTime.prototype, "shouldComponentUpdate");
            spyCDU = sinon.spy(RelativeTime.prototype, "componentDidUpdate");

            props = {
                time: "2018-02-14T17:12:00.000000Z"
            };

            wrapper = shallow(<RelativeTime {...props} />);
        });

        afterAll(() => {
            spySCU.restore();
            spyCDU.restore();
        });
    });
});
