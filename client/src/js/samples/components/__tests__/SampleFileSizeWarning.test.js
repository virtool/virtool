import { mapStateToProps, SampleFileSizeWarning } from "../FileSizeWarning";

describe("<SampleFileSizeWarning />", () => {
    let props;
    beforeEach(() => {
        props = {
            sampleId: "foo",
            show: true,
            showLink: true
        };
    });

    it("should render", () => {
        const wrapper = shallow(<SampleFileSizeWarning {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [show=false]", () => {
        props.show = false;
        const wrapper = shallow(<SampleFileSizeWarning {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should not render link when [showLink=false]", () => {
        props.showLink = false;
        const wrapper = shallow(<SampleFileSizeWarning {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps", () => {
    const state = {
        router: {
            location: {
                pathname: "/samples/foo"
            }
        },
        samples: {
            detail: {
                files: [{ size: 10 }]
            }
        }
    };

    it("should return show when [state.samples.detail.files.size<10000000]", () => {
        const props = mapStateToProps(state);
        expect(props).toEqual({ show: true, showLink: true });
    });

    it("should return show when [state.samples.detail.files.size>10000000]", () => {
        state.samples.detail.files = [{ size: 1000000000 }];
        const props = mapStateToProps(state);
        expect(props).toEqual({ show: false, showLink: true });
    });

    it("should return [showLink=false] when at files route", () => {
        state.router.location.pathname += "/files";
        const props = mapStateToProps(state);
        expect(props).toEqual({ show: false, showLink: false });
    });
});
