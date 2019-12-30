import { mapStateToProps, ClusterMembers } from "../ClusterMembers";

describe("<ClusterMembers />", () => {
    let props;
    beforeEach(() => {
        props = {
            detail: {
                entries: "foo"
            }
        };
    });
    it("should render", () => {
        const wrapper = shallow(<ClusterMembers {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps()", () => {
    const state = {
        hmms: {
            detail: "foo"
        }
    };
    it("should return props", () => {
        const props = mapStateToProps(state);
        expect(props).toEqual({
            detail: "foo"
        });
    });
});
