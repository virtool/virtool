import { SubtractionItem, SubtractionItemIcon, mapStateToProps } from "../Item";

describe("<SubtractionItemIcon />", () => {
    it.each([true, false])("should render when [ready=%p]", ready => {
        const wrapper = shallow(<SubtractionItemIcon ready={ready} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<SubtractionItem />", () => {
    let props;

    beforeEach(() => {
        props = {
            id: "Foo Bar",
            ready: true
        };
    });

    it.each([true, false])("should render when [ready=%p]", ready => {
        props.ready = ready;
        const wrapper = shallow(<SubtractionItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps()", () => {
    it("should return props", () => {
        const state = {
            subtraction: {
                documents: [
                    { id: "foo", ready: true },
                    { id: "bar", ready: true },
                    { id: "baz", ready: true }
                ]
            }
        };
        const props = mapStateToProps(state, { index: 1 });
        expect(props).toEqual({
            id: "bar",
            ready: true
        });
    });
});
