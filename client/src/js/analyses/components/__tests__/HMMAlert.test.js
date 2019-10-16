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
    const state = {
        hmms: {
            status: {
                installed: {
                    foo: "bar"
                }
            }
        }
    };
    const props = mapStateToProps(state);

    expect(props).toEqual({
        installed: true
    });
});

describe("mapStateToProps when installed is not defineds", () => {
    const state = {
        hmms: {
            status: {}
        }
    };
    const props = mapStateToProps(state);

    expect(props).toEqual({
        installed: false
    });
});
