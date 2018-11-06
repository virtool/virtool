import { ScrollList, calculateScrollRatio } from "../ScrollList";
import { LoadingPlaceholder } from "../index";

describe("<ScrollList />", () => {
    let props;
    let wrapper;

    describe("renders correctly", () => {
        const Entry = () => <div>test entry</div>;
        const testEntryRender = index => <Entry key={index} />;

        props = {
            page: 1,
            pageCount: 20,
            documents: [{ id: "test" }],
            onLoadNextPage: jest.fn(),
            renderRow: testEntryRender
        };

        it("if [noContainer=true], render without container", () => {
            const wrapper = shallow(<ScrollList noContainer={true} {...props} />);
            expect(wrapper.html()).toEqual("<div>test entry</div>");
            expect(wrapper).toMatchSnapshot();
        });

        it("otherwise render within <div> container", () => {
            const wrapper = shallow(<ScrollList {...props} />);
            expect(wrapper.html()).toEqual("<div><div>test entry</div></div>");
            expect(wrapper).toMatchSnapshot();
        });

        it("renders a LoadingPlaceholder during a page retrieval request", () => {
            const wrapper = shallow(<ScrollList {...props} documents={null} />);
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

            spyListener = sinon.spy(wrapper.instance().scrollList.current, "removeEventListener");
            expect(spyListener.called).toBe(false);

            wrapper.unmount();

            expect(spy.called).toBe(true);
            expect(spyListener.called).toBe(true);
        });

        it("otherwise handleRemove scroll event listener from window", () => {
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

        it("if [isElement=true], calculate element's scroll ratio and determine whether to call onLoadNextPage()", () => {
            // Should calculate element scroll ratio, not call onLoadNextPage()
            let props = {
                isElement: true,
                documents: [],
                page: 1,
                pageCount: 3,
                onLoadNextPage: jest.fn(),
                renderRow: jest.fn()
            };
            const wrapper = mount(<ScrollList {...props} />);
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
            expect(props.onLoadNextPage).not.toHaveBeenCalled();
            spy.resetHistory();

            // Should calculate element scroll ratio, call current page refetch
            props = {
                isElement: true,
                documents: [{ id: "test" }],
                page: 2,
                pageCount: 5,
                onLoadNextPage: sinon.spy(),
                renderRow: jest.fn(index => <div key={index}>{index}</div>)
            };
            wrapper.setProps(props);

            expect(spy.called).toBe(false);
            expect(props.onLoadNextPage.called).toBe(false);

            wrapper.instance().onScroll();

            expect(spy.called).toBe(true);
            expect(props.onLoadNextPage.calledWith(props.page + 1)).toBe(true);

            // Reset dimensions to zero
            Object.defineProperties(wrapper.instance().scrollList.current, {
                clientHeight: { writable: true, value: 0 },
                scrollTop: { writable: true, value: 0 },
                scrollHeight: { writable: true, value: 0 }
            });
        });

        it("otherwise calculate window scroll ratio to determine whether to call onLoadNextPage()", () => {
            // Test environment defaults: window.innerHeight = 768, window.scrollY = 0

            // Manually set document scrollHeight === window height
            Object.defineProperty(document.documentElement, "scrollHeight", {
                writable: true,
                value: window.innerHeight
            });

            const props = {
                isElement: false,
                page: 2,
                pageCount: 5,
                documents: [{ id: "test" }],
                onLoadNextPage: sinon.spy(),
                renderRow: jest.fn()
            };

            const wrapper = mount(<ScrollList {...props} />);

            const spy = sinon.spy(wrapper.instance(), "onScroll");
            expect(spy.called).toBe(false);
            expect(props.onLoadNextPage.called).toBe(false);

            wrapper.instance().onScroll();

            expect(spy.called).toBe(true);
            expect(props.onLoadNextPage.calledWith(props.page + 1)).toBe(true);

            // Reset field to 0
            Object.defineProperty(document.documentElement, "scrollHeight", {
                writable: true,
                value: 0
            });
        });
    });

    describe("Helper functions", () => {
        it("calculateScrollRatio(): returns scroll ratio to one decimal place", () => {
            const innerHeight = 500;
            const scrollY = 500;
            const scrollHeight = 2000;

            const result = calculateScrollRatio(innerHeight, scrollY, scrollHeight);
            const expected = "0.5";

            expect(result).toEqual(expected);
        });
    });
});
