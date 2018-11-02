import NuVsList from "../List";

describe("<NuVsList />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        props = {
            analysisId: "test-analysis",
            maxSequenceLength: 3,
            data: [
                {
                    orfs: [{ hits: [] }]
                }
            ]
        };
        wrapper = shallow(<NuVsList {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
