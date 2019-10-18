import { AnalysisHMMAlert, mapStateToProps } from "../HMMAlert";

describe("<AnalysisHMMAlert />", () => {
    let props;

    beforeEach(() => {
        props = {
            installed: true
        };
    });

    it("should render", () => {
        const wrapper = shallow(<AnalysisHMMAlert {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [installed = false]", () => {
        props.installed = false;
        const wrapper = shallow(<AnalysisHMMAlert {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("mapStateToProps", () => {
    let state;

    beforeEach(() => {
        state = {
            hmms: {
                status: {}
            }
        };
    });

    it("should return true when installed", () => {
        state.hmms.status.installed = {
            foo: "bar"
        };

        const props = mapStateToProps(state);

        expect(props).toEqual({
            installed: true
        });
    });

    it("should return false when installed is not defined", () => {
        const props = mapStateToProps(state);

        expect(props).toEqual({
            installed: false
        });
    });
});
