import Task from "./Task";

describe("<Task />", () => {
  const props = {
    inst: 10,
    mem: 5,
    proc: 3,
    taskPrefix: "test",
    minProc: 1,
    minMem: 1,
    resourceProc: 8,
    resourceMem: 7,
    readOnlyFields: []
  };
  let wrapper;
  let spy;

  it("renders correctly", () => {
    wrapper = shallow(<Task {...props} />);

    expect(wrapper).toMatchSnapshot();
  });

  it("componentDidUpdate: resets state and clears errors when limits are reset to previous values", () => {
    spy = sinon.spy(Task.prototype, "componentDidUpdate");
    expect(spy.called).toBe(false);

    wrapper = shallow(<Task {...props} />);

    const errorState = { exceedsError: true, zeroError: true };

    wrapper.setState(errorState);
    expect(wrapper.state()).toEqual(errorState);

    wrapper.setProps({ ...props, proc: props.proc + 1 });
    expect(spy.called).toBe(true);
    expect(wrapper.state()).toEqual(errorState);

    wrapper.setProps({ ...props, proc: props.proc + 1 });
    expect(wrapper.state()).toEqual({ exceedsError: false, zeroError: false });

    spy.restore();
  });

  it("handleChangeLimit(): resets state via handleClearError() and calls onChangeLimit callback function", () => {
    const spyCallback = sinon.spy();
    wrapper = mount(<Task {...props} onChangeLimit={spyCallback} />);
    spy = sinon.spy(wrapper.instance(), "handleChangeLimit");
    const spyClear = sinon.spy(wrapper.instance(), "handleClearError");

    expect(spy.called).toBe(false);
    expect(spyClear.called).toBe(false);

    wrapper.instance().handleChangeLimit("inst", 4);

    expect(spy.calledOnce).toBe(true);
    expect(spyClear.calledOnce).toBe(true);
    expect(spyCallback.calledWith("test", "inst", 4)).toBe(true);

    spy.restore();
    spyClear.restore();
  });

  it("handleInvalid(): handles invalid inputs including edge case '0' assignment", () => {
    wrapper = mount(<Task {...props} />);
    expect(wrapper.state()).toEqual({ exceedsError: false, zeroError: false });

    wrapper.instance().handleInvalid({ target: { value: "0" } });
    expect(wrapper.state()).toEqual({ exceedsError: false, zeroError: true });

    wrapper.instance().forceUpdate();

    wrapper.instance().handleInvalid({ target: { value: "-5" } });
    expect(wrapper.state()).toEqual({ exceedsError: true, zeroError: false });
  });
});
