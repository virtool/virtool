import { ScrollList, getScrollRatio } from "./ScrollList";
import { LoadingPlaceholder } from "./index";

describe("<ScrollList />", () => {
    let props;
    let wrapper;

    describe("renders correctly", () => {

        const Entry = () => (<div>test entry</div>);
        const testEntryRender = (index) => (<Entry key={index} />);

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
            wrapper = shallow(<ScrollList isNextPageLoading={true} hasNextPage={true} />);

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
        let spyListener;

        afterAll(() => {
            spy.restore();
            spyListener.restore();
        });

        it("otherwise [isElement=true] or no further pages are available, no change", () => {
            spy = sinon.spy(ScrollList.prototype, "componentDidUpdate");
            expect(spy.called).toBe(false);

            props = {
                isElement: false,
                refetchPage: true,
                loadNextPage: jest.fn(),
                isNextPageLoading: false,
                hasNextPage: true,
                style: { height: "768px" }
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

        afterAll(() => {
            spy.restore();
            spyListener.restore();
        });

        it("if [isElement=true], remove element's scroll event listener", () => {
            spy = sinon.spy(ScrollList.prototype, "componentWillUnmount");

            expect(spy.called).toBe(false);

            wrapper = mount(<ScrollList isElement={true} />);
            expect(wrapper.instance().scrollList).toBeTruthy();
            wrapper.unmount();
            expect(spy.called).toBe(true);

            spy.resetHistory();
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
