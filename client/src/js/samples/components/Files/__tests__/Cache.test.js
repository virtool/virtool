import { mapStateToProps, SampleFilesCache } from "../Cache";

describe("<SampleFilesCache />", () => {
    it("should render", () => {
        const caches = [
            {
                created_at: "2018-01-01T00:00:00.000000Z",
                files: [{ name: "reads_1.fastq.gz", size: 136569053 }],
                hash: "abc123",
                id: "foo",
                missing: false
            },
            {
                created_at: "2018-02-01T00:00:00.000000Z",
                files: [{ name: "reads_1.fastq.gz", size: 290100291 }],
                hash: "xyz789",
                id: "baz",
                missing: true
            }
        ];
        const wrapper = shallow(<SampleFilesCache caches={caches} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render NoneFound when caches array empty", () => {
        const wrapper = shallow(<SampleFilesCache caches={[]} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps()", () => {
    it("should return props", () => {
        const caches = [{ id: "foo" }, { id: "bar" }];
        const state = {
            samples: {
                detail: {
                    caches
                }
            }
        };
        const props = mapStateToProps(state);
        expect(props).toEqual({ caches });
    });
});
