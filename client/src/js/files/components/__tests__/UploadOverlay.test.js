import { UploadOverlay, mapStateToProps } from "../UploadOverlay";

describe("<UploadOverlay />", () => {
    let props;

    beforeEach(() => {
        props = {
            uploads: [
                {
                    fileType: "subtraction",
                    localId: "123abc",
                    name: "test_reads.fastq.gz",
                    progress: 100,
                    size: 1024
                },
                {
                    fileType: "reads",
                    localId: "456def",
                    name: "test_reads.fastq.gz",
                    progress: 0,
                    size: 1024
                },
                {
                    fileType: "reads",
                    localId: "789ghi",
                    name: "test_reads.fastq.gz",
                    progress: 50,
                    size: 1024
                }
            ]
        };
    });

    it("should render", () => {
        const wrapper = shallow(<UploadOverlay {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should return null if no uploads", () => {
        props.uploads = [];
        const wrapper = shallow(<UploadOverlay {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps", () => {
    let state;

    beforeEach(() => {
        state = {
            files: {
                uploads: [
                    { localId: "foo", progress: 0 },
                    { localId: "bar", progress: 12 },
                    { localId: "baz", progress: 37 }
                ]
            }
        };
    });

    it("should return sorted uploads in props", () => {
        const props = mapStateToProps(state);
        const [baz, bar, foo] = props.uploads;

        expect(props).toEqual({
            uploads: [baz, bar, foo]
        });
    });

    it("should exclude reference uploads", () => {
        state.files.uploads[1].fileType = "reference";
        const props = mapStateToProps(state);
        const [baz, foo] = props.uploads;
        expect(props).toEqual({
            uploads: [baz, foo]
        });
    });
});
