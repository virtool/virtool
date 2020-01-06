import { ScrollList, calculateScrollRatio, getEventTarget } from "../ScrollList";
import { LoadingPlaceholder } from "../index";

describe("<ScrollList />", () => {
    let props;
    let state;

    beforeEach(() => {
        props = {
            isElement: true,
            document: [{ foo: "bar" }],
            page: 1,
            pageCount: 2,
            onLoadNextPage: jest.fn(),
            style: "baz"
        };
        state = {};
    });

    it("should render", () => {
        const wrapper = shallow(<ScrollList {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
