import { SampleCacheItem, mapStateToProps } from "../CacheItem";

describe("<SampleCacheItem />", () => {
    it.each([false, true])("should render when [missing=%p]", missing => {
        const props = {
            createdAt: "2018-01-01T00:00:00.000000Z",
            files: [{ name: "reads_1.fastq.gz", size: 136569053 }],
            hash: "abc123",
            id: "foo",
            sampleId: "bar",
            missing
        };
        const wrapper = shallow(<SampleCacheItem {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps()", () => {
    it("should return props", () => {
        const state = {
            samples: {
                detail: { id: "foo" }
            }
        };
        const props = mapStateToProps(state);
        expect(props).toEqual({
            sampleId: "foo"
        });
    });
});
