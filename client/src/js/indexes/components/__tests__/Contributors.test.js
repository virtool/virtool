import { Contributor, Contributors, mapStateToProps } from "../Contributors";

describe("<Contributor />", () => {
    let props;

    beforeEach(() => {
        props = {
            id: "bob",
            count: 1
        };
    });

    it("should render when count is 1", () => {
        const wrapper = shallow(<Contributor {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when count is 5", () => {
        props.count = 5;
        const wrapper = shallow(<Contributor {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<Contributors />", () => {
    it("should render", () => {
        const props = {
            contributors: [
                { id: "bob", count: 5 },
                { id: "fred", count: 12 }
            ]
        };
        const wrapper = shallow(<Contributors {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps()", () => {
    it("should return props", () => {
        const contributors = [
            { id: "bob", count: 5 },
            { id: "fred", count: 12 }
        ];
        const state = {
            indexes: {
                detail: {
                    contributors
                }
            }
        };
        const result = mapStateToProps(state);
        expect(result).toEqual({ contributors });
    });
});
