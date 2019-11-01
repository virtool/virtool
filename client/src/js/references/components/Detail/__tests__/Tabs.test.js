import { ReferenceDetailTabs, mapStateToProps } from "../Tabs";

describe("<ReferenceDetailTabs />", () => {
    it("should render", () => {
        const props = {
            id: "foo",
            otuCount: 203
        };

        const wrapper = shallow(<ReferenceDetailTabs {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps", () => {
    it("should return props", () => {
        const state = {
            references: {
                detail: {
                    id: "bar",
                    otu_count: 321
                }
            }
        };
        const result = mapStateToProps(state);
        expect(result).toEqual({
            id: "bar",
            otuCount: 321
        });
    });
});
