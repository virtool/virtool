import { mapStateToProps, SampleFileSizeWarning } from "../SampleFileSizeWarning";

describe("<SampleFileSizeWarning />", () => {
    let props;
    beforeEach(() => {
        props = {
            show: true
        };
    });

    it("should render when [show=true]", () => {
        const wrapper = shallow(<SampleFileSizeWarning {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
    it("should render when [show=false]", () => {
        props.show = false;
        const wrapper = shallow(<SampleFileSizeWarning {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps", () => {
    const state = {
        samples: {
            detail: {
                files: [{ size: 10 }]
            }
        }
    };
    it("should return show when [state.samples.detail.files.size<10000000]", () => {
        const props = mapStateToProps(state);
        expect(props).toEqual({ show: true });
    });
    it("should return show when [state.samples.detail.files.size>10000000]", () => {
        state.samples.detail.files = [{ size: 1000000000 }];
        const props = mapStateToProps(state);
        expect(props).toEqual({ show: false });
    });
});
