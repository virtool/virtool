import { RebuildAlert, mapStateToProps } from "../RebuildAlert";

describe("<RebuildAlert />", () => {
    let props;

    beforeEach(() => {
        props = {
            refId: "foo",
            showCountAlert: 0,
            showIndexAlert: true
        };
    });

    it("should render", () => {
        const wrapper = shallow(<RebuildAlert {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should render when [showCountAlert!=0, showIndexAlert=true]", () => {
        props.showCountAlert = 1;
        const wrapper = shallow(<RebuildAlert {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should return null when [showCountAlert!=0, showIndexAlert=false]", () => {
        props.showCountAlert = 1;
        props.showIndexAlert = false;
        const wrapper = shallow(<RebuildAlert {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps()", () => {
    it("should return props", () => {
        const state = {
            references: {
                detail: {
                    id: "foo"
                }
            },
            indexes: {
                modified_otu_count: 1,
                total_otu_count: 1
            },
            otus: {
                modified_count: 1,
                total_count: 1
            },
            account: {
                administrator: true
            }
        };
        const props = mapStateToProps(state);
        expect(props).toEqual({
            refId: "foo",
            showIndexAlert: 1,
            showCountAlert: 1
        });
    });
});
