import { SegmentCol } from "../SegmentCol";

describe("<SegmentCol />", () => {
    const props = {
        value: "foo",
        onChange: jest.fn(),
        error: "baz",
        segmentNames: "bar"
    };
    it("should render", () => {
        const wrapper = shallow(<SegmentCol {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
