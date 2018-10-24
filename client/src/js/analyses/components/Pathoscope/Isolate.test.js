import PathoscopeIsolate from "./Isolate";
import Coverage from "./Coverage";

describe("<PathoscopeIsolate />", () => {
  let props;
  let wrapper;
  let spy;

  beforeEach(() => {
    props = {
      otuId: "test-otu",
      name: "test-pathoscope",
      pi: 3,
      coverage: 0,
      depth: 2,
      maxDepth: 5,
      meanDepth: 3,
      medianDepth: 2,
      reads: 1,
      sequences: [],
      setScroll: sinon.spy(),
      showReads: true
    };
    wrapper = mount(<PathoscopeIsolate {...props} />);
  });

  it("renders correctly", () => {
    expect(wrapper.children()).toMatchSnapshot();

    props = {
      ...props,
      sequences: [
        {
          align: [[0, 0]],
          length: 5,
          id: "123abc",
          definition: "test-definition"
        }
      ],
      showReads: false
    };
    wrapper = mount(<PathoscopeIsolate {...props} />);
    expect(wrapper.find(Coverage).length).toEqual(1);
  });

  it("Component unmount removes scroll event listener from chart element", () => {
    spy = sinon.spy(
      wrapper
        .children()
        .childAt(1)
        .instance(),
      "removeEventListener"
    );

    wrapper.unmount();
    expect(spy.calledOnce).toBe(true);

    spy.restore();
  });

  it("scrollTo() sets this chart element scrollLeft property to a specified value", () => {
    spy = sinon.spy(wrapper.instance(), "scrollTo");

    const newScrollValue = 123;
    const chartElement = wrapper
      .children()
      .childAt(1)
      .instance();

    expect(chartElement.scrollLeft).toEqual(0);

    wrapper.instance().scrollTo(newScrollValue);
    expect(chartElement.scrollLeft).toEqual(newScrollValue);

    spy.restore();
  });

  it("Scroll event calls setScroll callback prop", () => {
    spy = sinon.spy(wrapper.instance(), "handleScroll");

    wrapper.instance().handleScroll({ target: { scrollLeft: 10 } });
    expect(props.setScroll.calledWith(props.otuId, 10)).toBe(true);

    spy.restore();
  });
});
