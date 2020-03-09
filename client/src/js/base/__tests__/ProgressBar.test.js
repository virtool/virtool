import { ProgressBar, AffixedProgressBar } from "../ProgressBar";

describe("<ProgressBar />", () => {
    const props = {
        now: 0,
        bsStyle: ""
    };

    it("should render when [bsStyle='success']", () => {
        props.bsStyle = "success";
        const wrapper = shallow(<ProgressBar {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [bsStyle='warning']", () => {
        props.bsStyle = "warning";
        const wrapper = shallow(<ProgressBar {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [bsStyle='danger']", () => {
        props.bsStyle = "danger";
        const wrapper = shallow(<ProgressBar {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});

describe("<AffixedProgressBar />", () => {
    const props = {
        now: 0,
        bsStyle: ""
    };

    it("should render when [bsStyle='success']", () => {
        props.bsStyle = "success";
        const wrapper = shallow(<AffixedProgressBar {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [bsStyle='warning']", () => {
        props.bsStyle = "warning";
        const wrapper = shallow(<AffixedProgressBar {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render when [bsStyle='danger']", () => {
        props.bsStyle = "danger";
        const wrapper = shallow(<AffixedProgressBar {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
