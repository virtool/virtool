import { AnalysesList } from "../List";

describe("<AnalysesList />", () => {
    let props;

    beforeEach(() => {
        props = {
            showCreate: true,
            userId: "bob",
            sampleId: "foo",
            analyses: [{ id: "bar" }],
            term: "baz",
            indexes: [{ id: "indy" }],
            hmmsInstalled: true,
            canModify: true,
            onFind: jest.fn()
        };
    });

    it("renders", () => {
        const wrapper = shallow(<AnalysesList {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
