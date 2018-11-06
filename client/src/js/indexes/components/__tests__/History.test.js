import RebuildHistory from "../History";

describe("<History />", () => {
    let props;
    let wrapper;

    it("renders first page of change log with surplus of changes noted", () => {
        props = {
            unbuilt: {
                page_count: 2,
                total_count: 10,
                per_page: 5,
                documents: [
                    {
                        id: "123abc",
                        otu: { name: "test-otu" },
                        description: "test-description"
                    }
                ]
            },
            error: false
        };
        wrapper = shallow(<RebuildHistory {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders all changes in first page with error styling", () => {
        props = {
            unbuilt: {
                page_count: 1,
                total_count: 10,
                per_page: 5,
                documents: [
                    {
                        id: "123abc",
                        otu: { name: "test-otu" },
                        description: ""
                    }
                ]
            },
            error: true
        };
        wrapper = shallow(<RebuildHistory {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders <LoadingPlaceholder /> when unbuilt data is not available", () => {
        props = { unbuilt: null, error: false };
        wrapper = shallow(<RebuildHistory {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
