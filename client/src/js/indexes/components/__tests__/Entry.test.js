import IndexEntry from "../Entry";

describe("<IndexEntry />", () => {
    let props;
    let wrapper;

    beforeEach(() => {
        props = {
            id: "test-entry",
            ready: true,
            refId: "test-reference",
            showReady: true,
            created_at: "2018-02-14T17:12:00.000000Z",
            version: 0,
            change_count: 3,
            modified_otu_count: 5
        };
        wrapper = shallow(<IndexEntry {...props} />);
    });

    it("renders Active index entry with description of changes in multiple OTUs", () => {
        expect(wrapper).toMatchSnapshot();
    });

    it("renders Building index entry with description of change in one OTU", () => {
        wrapper.setProps({
            ready: false,
            modified_otu_count: 1
        });
        expect(wrapper).toMatchSnapshot();
    });

    it("renders older index entry with no changes", () => {
        wrapper.setProps({
            showReady: false,
            change_count: 0
        });
        expect(wrapper).toMatchSnapshot();
    });

    it("renders older index entry without change description", () => {
        wrapper.setProps({
            showReady: false,
            change_count: null
        });
        expect(wrapper).toMatchSnapshot();
    });
});
