import { ReferenceItemBuild } from "../Build";

describe("<ReferenceItemBuild />", () => {
    let props;

    beforeEach(() => {
        props = {
            id: "foo",
            latestBuild: {
                created_at: "2018-01-01T00:00:00.000000Z",
                id: "bar",
                user: {
                    id: "bob"
                },
                version: 3
            },
            progress: 100
        };
    });

    it("should render build info when latestBuild available and [progress=100]", () => {
        const wrapper = shallow(<ReferenceItemBuild {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render 'No Build Found' when [latestBuild=null]", () => {
        props.latestBuild = null;
        const wrapper = shallow(<ReferenceItemBuild {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render 'No Build Found' when [progress=30]", () => {
        props.progress = 30;
        const wrapper = shallow(<ReferenceItemBuild {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps()", () => {
    let state;

    beforeEach(() => {
        state = {

        }
    })
})
