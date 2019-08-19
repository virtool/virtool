import { OTUItem, mapStateToProps } from "../Item";

describe("<OTUItem />", () => {
    let props;

    beforeEach(() => {
        props = {
            abbreviation: "FB",
            id: "foo",
            name: "Foo",
            verified: true,
            refId: "baz"
        };
    });

    it("should render when [verified=true]", () => {
        const wrapper = shallow(<OTUItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [verified=false]", () => {
        props.verified = false;
        const wrapper = shallow(<OTUItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps()", () => {
    it("should return props given state", () => {
        const state = {
            otus: {
                documents: [
                    { id: "foo", name: "Foo", abbreviation: "FO", verified: true },
                    { id: "bar", name: "Bar", abbreviation: "BR", verified: true },
                    { id: "baz", name: "Baz", abbreviation: "BZ", verified: true }
                ]
            },
            references: {
                detail: {
                    id: "ref"
                }
            }
        };
        const result = mapStateToProps(state, { index: 1 });
        expect(result).toEqual({
            id: "bar",
            name: "Bar",
            abbreviation: "BR",
            verified: true,
            refId: "ref"
        });
    });
});
