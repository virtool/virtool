import RebuildHistory, { RebuildHistoryEllipsis, RebuildHistoryItem } from "../History";

describe("<RebuildHistoryEllipsis />", () => {
    let props;

    beforeEach(() => {
        props = {
            unbuilt: {
                page_count: 10,
                per_page: 5,
                total_count: 53
            }
        };
    });

    it("should render when page_count greater than 1", () => {
        const wrapper = shallow(<RebuildHistoryEllipsis {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when page_count is 1", () => {
        props.unbuilt.page_count = 1;
        const wrapper = shallow(<RebuildHistoryEllipsis {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<RebuildHistoryItem />", () => {
    it("should render with description", () => {
        const props = {
            description: "Removed OTU",
            otuName: "Foobar Virus"
        };
        const wrapper = shallow(<RebuildHistoryItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render without description", () => {
        const props = {
            otuName: "Foobar Virus"
        };
        const wrapper = shallow(<RebuildHistoryItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<RebuildHistory />", () => {
    let props;

    beforeEach(() => {
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
    });

    it("should render without error", () => {
        const wrapper = shallow(<RebuildHistory {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render with error", () => {
        props.error = true;
        const wrapper = shallow(<RebuildHistory {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render <LoadingPlaceholder /> when unbuilt is null", () => {
        props.unbuilt = null;
        const wrapper = shallow(<RebuildHistory {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
