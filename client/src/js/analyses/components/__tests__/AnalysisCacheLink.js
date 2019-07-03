import { AnalysisCacheLink } from "../CacheLink";

describe("<AnalysisCacheLink />", () => {
    let props;

    beforeEach(() => {
        props = {
            id: "bar",
            sampleId: "foo"
        };
    });

    it("should render when id is defined", () => {
        const wrapper = shallow(<AnalysisCacheLink {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should return null when id is undefined", () => {
        delete props.id;
        const wrapper = shallow(<AnalysisCacheLink {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
