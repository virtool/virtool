import { ScrollList, getScrollRatio } from "./ScrollList";
import { LoadingPlaceholder } from "./index";

describe("<ScrollList />", () => {
  let props;
  let wrapper;

  describe("renders correctly", () => {
    const Entry = () => <div>test entry</div>;
    const testEntryRender = index => <Entry key={index} />;

    props = {
      page: 1,
      list: [{ id: "test" }],
      refetchPage: false,
      loadNextPage: jest.fn(),
      rowRenderer: testEntryRender,
      isNextPageLoading: false,
      hasNextPage: false,
      isLoadError: false
    };

    it("if [noContainer=true], render without container", () => {
      wrapper = shallow(<ScrollList noContainer={true} {...props} />);

      expect(wrapper.html()).toEqual("<div>test entry</div>");
      expect(wrapper).toMatchSnapshot();
    });

    it("otherwise render within <div> container", () => {
      wrapper = shallow(<ScrollList {...props} />);

      expect(wrapper.html()).toEqual("<div><div>test entry</div></div>");
      expect(wrapper).toMatchSnapshot();
    });

    it("renders a cliploader during a page retrieval request", () => {
      wrapper = shallow(
        <ScrollList isNextPageLoading={true} hasNextPage={true} />
      );

      expect(wrapper.find(LoadingPlaceholder).exists()).toBe(true);
      expect(wrapper).toMatchSnapshot();
    });
  });

  describe("componentDidMount", () => {
    let spy;
    let spyListener;

    afterAll(() => {
      spy.restore();
      spyListener.restore();
    });

    it("if [isElement=true], add scroll event listener to current component", () => {
      spy = sinon.spy(ScrollList.prototype, "componentDidMount");

      expect(spy.called).toBe(false);

      wrapper = mount(<ScrollList isElement={true} />);
      expect(wrapper.instance().scrollList).toBeTruthy();
      expect(spy.called).toBe(true);

      spy.resetHistory();
    });

    it("otherwise add scroll event listener to window", () => {
      spyListener = sinon.spy(window, "addEventListener");

      expect(spy.called).toBe(false);
      expect(spyListener.called).toBe(false);

      wrapper = mount(<ScrollList isElement={false} />);

      expect(spy.called).toBe(true);
      expect(spyListener.called).toBe(true);
    });
  });

  describe("componentDidUpdate", () => {
    let spy;

    afterEach(() => {
      spy.restore();
    });

    it("if entry deletion results in loss of scrollbars, refetch current page if appropriate", () => {
      spy = sinon.spy(ScrollList.prototype, "componentDidUpdate");
      expect(spy.called).toBe(false);

      // Manually set document scrollHeight === window height
      // Default value in test environment (jsdom) for document.documentElement.scrollHeight is 0
      Object.defineProperty(document.documentElement, "scrollHeight", {
        writable: true,
        value: window.innerHeight
      });

      props = {
        page: 1,
        isElement: false,
        refetchPage: true,
        loadNextPage: jest.fn(),
        isNextPageLoading: false,
        hasNextPage: true
      };

      wrapper = shallow(<ScrollList />);
      wrapper.setProps(props);

      expect(spy.called).toBe(true);
      expect(props.loadNextPage).toHaveBeenCalled();

      // Reset field to 0
      Object.defineProperty(document.documentElement, "scrollHeight", {
        writable: true,
        value: 0
      });
    });

    it("otherwise [isElement=true] or no further pages are available, no change", () => {
      spy = sinon.spy(ScrollList.prototype, "componentDidUpdate");
      expect(spy.called).toBe(false);

      props = {
        isElement: false,
        refetchPage: false,
        loadNextPage: jest.fn(),
        isNextPageLoading: false,
        hasNextPage: false
      };

      wrapper = shallow(<ScrollList />);
      wrapper.setProps(props);

      expect(spy.called).toBe(true);
      expect(props.loadNextPage).not.toHaveBeenCalled();
    });
  });

  describe("componentWillUnmount", () => {
    let spy;
    let spyListener;

    beforeEach(() => {
      spy = sinon.spy(ScrollList.prototype, "componentWillUnmount");
    });

    afterEach(() => {
      spy.restore();
      spyListener.restore();
    });

    it("if [isElement=true], remove element's scroll event listener", () => {
      expect(spy.called).toBe(false);

      wrapper = mount(<ScrollList isElement={true} />);
      expect(wrapper.instance().scrollList).toBeTruthy();

      spyListener = sinon.spy(
        wrapper.instance().scrollList.current,
        "removeEventListener"
      );
      expect(spyListener.called).toBe(false);

      wrapper.unmount();

      expect(spy.called).toBe(true);
      expect(spyListener.called).toBe(true);
    });

    it("otherwise remove scroll event listener from window", () => {
      spyListener = sinon.spy(window, "removeEventListener");

      expect(spy.called).toBe(false);
      expect(spyListener.called).toBe(false);

      wrapper = mount(<ScrollList isElement={false} />);
      wrapper.unmount();

      expect(spy.called).toBe(true);
      expect(spyListener.called).toBe(true);
    });
  });

  describe("onScroll", () => {
    let spy;

    afterEach(() => {
      spy.restore();
    });

    it("if [isElement=true], calculate element's scroll ratio and determine whether to call loadNextPage()", () => {
      // Should calculate element scroll ratio, not call loadNextPage()
      props = {
        isElement: true,
        list: [],
        refetchPage: true,
        loadNextPage: jest.fn(),
        rowRenderer: jest.fn(),
        isNextPageLoading: false,
        hasNextPage: false
      };
      wrapper = mount(<ScrollList {...props} />);
      expect(wrapper.instance().scrollList).toBeTruthy();

      // Set current scrollList element dimensions so that ratio = 1
      Object.defineProperties(wrapper.instance().scrollList.current, {
        clientHeight: { writable: true, value: 10 },
        scrollTop: { writable: true, value: 10 },
        scrollHeight: { writable: true, value: 20 }
      });

      spy = sinon.spy(wrapper.instance(), "onScroll");
      expect(spy.called).toBe(false);

      wrapper.instance().onScroll();

      expect(spy.called).toBe(true);
      expect(props.loadNextPage).not.toHaveBeenCalled();
      spy.resetHistory();

      // Should calculate element scroll ratio, call current page refetch
      props = {
        isElement: true,
        list: [{ id: "test" }],
        page: 2,
        refetchPage: true,
        loadNextPage: sinon.spy(),
        rowRenderer: jest.fn(index => <div key={index}>{index}</div>),
        isNextPageLoading: false,
        hasNextPage: true
      };
      wrapper.setProps(props);

      expect(spy.called).toBe(false);
      expect(props.loadNextPage.called).toBe(false);

      wrapper.instance().onScroll();

      expect(spy.called).toBe(true);
      expect(props.loadNextPage.calledWith(props.page)).toBe(true);

      // Reset dimensions to zero
      Object.defineProperties(wrapper.instance().scrollList.current, {
        clientHeight: { writable: true, value: 0 },
        scrollTop: { writable: true, value: 0 },
        scrollHeight: { writable: true, value: 0 }
      });
    });

    it("otherwise calculate window scroll ratio to determine whether to call loadNextPage()", () => {
      // Test environment defaults: window.innerHeight = 768, window.scrollY = 0

      // Manually set document scrollHeight === window height
      Object.defineProperty(document.documentElement, "scrollHeight", {
        writable: true,
        value: window.innerHeight
      });

      props = {
        isElement: false,
        page: 2,
        list: [{ id: "test" }],
        refetchPage: false,
        loadNextPage: sinon.spy(),
        rowRenderer: jest.fn(),
        isNextPageLoading: false,
        hasNextPage: true
      };
      wrapper = mount(<ScrollList {...props} />);

      spy = sinon.spy(wrapper.instance(), "onScroll");
      expect(spy.called).toBe(false);
      expect(props.loadNextPage.called).toBe(false);

      wrapper.instance().onScroll();

      expect(spy.called).toBe(true);
      expect(props.loadNextPage.calledWith(props.page + 1)).toBe(true);

      // Reset field to 0
      Object.defineProperty(document.documentElement, "scrollHeight", {
        writable: true,
        value: 0
      });
    });
  });

  describe("Helper functions", () => {
    it("getScrollRatio(): returns scroll ratio to one decimal place", () => {
      const innerHeight = 500;
      const scrollY = 500;
      const scrollHeight = 2000;

      const result = getScrollRatio(innerHeight, scrollY, scrollHeight);
      const expected = "0.5";

      expect(result).toEqual(expected);
    });
  });
});
