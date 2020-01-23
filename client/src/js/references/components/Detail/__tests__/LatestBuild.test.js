import { LatestBuild } from "../LatestBuild";

describe("<LatestBuild />", () => {
    const props = {
        id: "foo",
        latestBuild: {
            id: "bar",
            version: "1.0",
            created_at: "2",
            user: { id: "baz" }
        }
    };

    it("should render when [latestBuild!=null]", () => {
        const wrapper = shallow(<LatestBuild {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [latestBuild=null]", () => {
        props.latestBuild = null;
        const wrapper = shallow(<LatestBuild {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
