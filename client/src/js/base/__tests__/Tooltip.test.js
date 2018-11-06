import { Tooltip } from "../Tooltip";

describe("<Tooltip />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        wrapper = shallow(<Tooltip />);

        expect(wrapper).toMatchSnapshot();
    });

    it("renders a .tooltip div", () => {
        wrapper = shallow(<Tooltip />);

        expect(wrapper.find(".tooltip").length).toEqual(1);
    });

    it("renders a header subcomponent when header prop is provided", () => {
        props = {
            header: "test-header"
        };
        wrapper = shallow(<Tooltip {...props} />);

        expect(wrapper.find(".tooltip-header").length).toEqual(1);
    });

    it("renders a body subcomponent that contains optional children nodes if supplied", () => {
        props = {
            children: <div className="test-child" />
        };
        wrapper = shallow(<Tooltip {...props} />);

        const expected = '<div class="test-child"></div>';

        expect(
            wrapper
                .find(".tooltip-body")
                .childAt(0)
                .html()
        ).toEqual(expected);
    });

    it("renders tooltip placement relative to given x & y props", () => {
        props = {
            x: 10,
            y: 20
        };
        wrapper = shallow(<Tooltip {...props} />);

        expect(wrapper.find(".tooltip").prop("style")).toEqual({
            left: props.x - 10 + "px",
            top: props.y - window.pageYOffset - 10 + "px",
            zIndex: 10000
        });
    });
});
