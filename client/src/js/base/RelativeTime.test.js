import Moment from "moment";
import { RelativeTime } from "./RelativeTime";

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

    it("should re-render if there is a difference in state or props", () => {
      spySCU.resetHistory();

      expect(spySCU.called).toBe(false);
      const expected = Moment(props.time).fromNow();
      expect(wrapper.state("timeString")).toEqual(expected);

      /* When given same props on update,
             * houldComponentUpdate returns false, no re-render */
      wrapper.setProps(props);
      expect(spySCU.called).toBe(true);
      expect(spySCU.returned(false)).toBe(true);

      // Given new time value on update, returns true, re-renders
      const update = { time: "2018-03-27T17:05:30.000000Z" };
      wrapper.setProps(update);
      expect(spySCU.returned(true)).toBe(true);
    });

    it("should update the timestamp to a timeString inside componentDidUpdate", () => {
      spyCDU.resetHistory();

      expect(spyCDU.called).toBe(false);

      const update = { time: "2018-03-20T17:09:45.000000Z" };
      wrapper.setProps(update);
      const expected = Moment(update.time).fromNow();

      expect(spyCDU.called).toBe(true);
      expect(wrapper.state("timeString")).toEqual(expected);
    });

    it("should not force an update in componentDidUpdate if timestamp remains the same", () => {
      const clock = sinon.useFakeTimers();

      const currentTime = Moment().toISOString();
      wrapper = mount(<RelativeTime time={`${currentTime}`} />);
      spyCDU.resetHistory();

      expect(spyCDU.calledOnce).toBe(false);
      expect(wrapper.state("timeString")).toEqual("just now");

      clock.tick(60000);

      expect(wrapper.state("timeString")).toEqual("a minute ago");

      clock.restore();
    });
  });
});
