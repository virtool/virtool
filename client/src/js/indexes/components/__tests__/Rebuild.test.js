import { RebuildIndexError } from "../RebuildError";

describe("RebuildIndexError", () => {
    let props;

    beforeEach(() => {
        props = {
            error: null
        };
    });

    it("should render nothing when error is falsey", () => {
        const wrapper = shallow(<RebuildIndexError {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render plain error", () => {
        props.error = "Index is foobar";
        const wrapper = shallow(<RebuildIndexError {...props} />);
        expect(wrapper).toMatchSnapshot();
    });

    it("should render extra text when error is 'There are unverified OTUs'", () => {
        props.error = "There are unverified OTUs";
        const wrapper = shallow(<RebuildIndexError {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
