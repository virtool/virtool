import { ProgressBar, AutoProgressBar } from "./ProgressBar";

describe("<ProgressBar />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        wrapper = shallow(<ProgressBar />);

        expect(wrapper).toMatchSnapshot();
    });

    it("applies given css properties to elements", () => {
        props = {
            affixed: true,
            style: { paddingTop: "100px" },
            bsStyle: "danger"
        };
        wrapper = shallow(<ProgressBar {...props} />);

        expect(wrapper.find('div').at(0).hasClass("progress progress-affixed")).toBe(true);
        expect(wrapper.find('div').at(0).prop('style')).toEqual(props.style);
        expect(wrapper.find('div').at(1).hasClass(`progress-bar progress-bar-${props.bsStyle}`)).toBe(true);
        expect(wrapper).toMatchSnapshot();
    });

    it("renders <div>, child <div> and optional children", () => {
        props = {
            children: <div id="test-child" />
        };
        wrapper = shallow(<ProgressBar {...props} />);

        expect(wrapper.find('div').length).toEqual(3);
        expect(wrapper.is('div')).toBe(true);
        expect(wrapper.childAt(0).is('div')).toBe(true);
        expect(wrapper.find('#test-child').exists()).toBe(true);
        expect(wrapper).toMatchSnapshot();
    });

    it("calls onTransitionend() when props.now changes", () => {

        props = {
            onMoved: jest.fn()
        };
        wrapper = mount(<ProgressBar {...props} />);

        wrapper.instance().onTransitionend();

        expect(props.onMoved).toHaveBeenCalled();
    });

    describe("<AutoProgressBar />", () => {

        it("renders correctly", () => {
            wrapper = shallow(<AutoProgressBar />);

            expect(wrapper).toMatchSnapshot();
        });

        it("renders a ProgressBar component if [state.fill>0], <div> otherwise", () => {
            wrapper = shallow(<AutoProgressBar />);

            expect(wrapper.find(ProgressBar).length).toEqual(0);
            expect(wrapper.find('div').hasClass("progress-affixed-empty")).toBe(true);

            wrapper.setState({ fill: 10 });

            expect(wrapper.find(ProgressBar).length).toEqual(1);
            expect(wrapper.find(".progress-affixed-empty").length).toEqual(0);
        });

    });
});
