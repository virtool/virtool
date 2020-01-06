import { ScrollList } from "../ScrollList";

describe("<ScrollList />", () => {
    let props;
    const addEventListener = jest.fn();
    const removeEventListener = jest.fn();

    beforeEach(() => {
        props = {
            isElement: true,
            document: [{ foo: "bar" }],
            page: 1,
            pageCount: 2,
            onLoadNextPage: jest.fn()
        };
    });

    it("should return LoadingPlaceholder when [documents === null] and [page < pageCount]", () => {
        props.documents = null;
        const wrapper = mount(<ScrollList {...props} />);
        wrapper.instance().scrollList.current = {
            addEventListener,
            removeEventListener
        };
        expect(wrapper).toMatchSnapshot();
    });

    it("should return React.Fragment when [noContainer == true]", () => {
        const wrapper = mount(<ScrollList {...props} />);
        wrapper.instance().scrollList.current = {
            addEventListener,
            removeEventListener
        };
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [noContainer == false]", () => {
        props.noContainer = false;
        const wrapper = mount(<ScrollList {...props} />);
        wrapper.instance().scrollList.current = {
            addEventListener,
            removeEventListener
        };
        expect(wrapper).toMatchSnapshot();
    });

    it("componentDidMount() should call addEventListener()", () => {
        const wrapper = mount(<ScrollList {...props} />);
        wrapper.instance().scrollList.current = {
            addEventListener,
            removeEventListener
        };
        wrapper.instance().componentDidMount();
        expect(wrapper.instance().scrollList.current.addEventListener).toHaveBeenCalledWith(
            "scroll",
            wrapper.instance().onScroll
        );
    });

    it("componentWillUnmount() should call removeEventListener()", () => {
        const wrapper = mount(<ScrollList {...props} />);

        wrapper.instance().scrollList.current = {
            addEventListener,
            removeEventListener
        };
        wrapper.instance().componentWillUnmount();
        expect(removeEventListener).toHaveBeenCalledWith("scroll", wrapper.instance().onScroll);
    });
});
