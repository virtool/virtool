import { ViewHeader, PageHint } from "./ViewHeader";
import { Badge } from "react-bootstrap";
import { Flex, FlexItem } from "./index";

describe("<ViewHeader />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        props = {
            page: 1,
            count: 5,
            foundCount: 20
        };
        wrapper = shallow(<ViewHeader {...props} />);

        expect(wrapper).toMatchSnapshot();
    });

    it("renders an <h3> element", () => {
        props = {
            page: 1,
            count: 5,
            foundCount: 20
        };
        wrapper = shallow(<ViewHeader {...props} />);

        expect(wrapper.find('h3').hasClass('view-header')).toBe(true);
    });

    it("renders a Flex subcomponent", () => {
        props = {
            page: 1,
            count: 5,
            foundCount: 20
        };
        wrapper = shallow(<ViewHeader {...props} />);

        expect(wrapper.find(Flex).length).toEqual(1);
    });

    it("further renders 2 FlexItem subcomponents", () => {
        props = {
            page: 1,
            count: 5,
            foundCount: 20
        };
        wrapper = shallow(<ViewHeader {...props} />);

        expect(wrapper.find(FlexItem).length).toEqual(2);
    });

    it("first FlextItem displays provided title prop and Badge component of totalCount prop", () => {
        props = {
            title: "Testing",
            page: 1,
            count: 5,
            foundCount: 20,
            totalCount: 100
        };
        wrapper = shallow(<ViewHeader {...props} />);

        expect(wrapper.find(FlexItem).at(0).childAt(0).text()).toEqual(props.title);
        expect(wrapper.find(Badge).childAt(0).text()).toEqual(`${props.totalCount}`);
    });

    it("second FlexItem renders a PageHint component", () => {
        props = {
            page: 2,
            count: 5,
            foundCount: 20
        };
        wrapper = shallow(<ViewHeader {...props} />);

        expect(wrapper.find(FlexItem).at(1).childAt(0).text()).toEqual("<PageHint />");
        expect(wrapper.find(PageHint).length).toEqual(1);
    });

    describe("<PageHint /> subcomponent", () => {

        beforeEach(() => {
            props = null;
            wrapper = null;
        });

        it("renders a <span> element", () => {
            props = {
                page: 2,
                count: 5,
                totalCount: 25
            };
            wrapper = shallow(<PageHint {...props} />);

            expect(wrapper.find('span').length).toEqual(1);
        });

        it("displays 0 of 0 if required props equal 0", () => {
            props = {
                page: 0,
                count: 0,
                totalCount: 0
            };
            wrapper = shallow(<PageHint {...props} />);
            
            expect(wrapper.find('span').text()).toEqual("Viewing 0 - 0 of 0");
            expect(wrapper).toMatchSnapshot();
        });

        it("displays first to last of totalCount otherwise", () => {
            props = {
                page: 3,
                count: 10,
                totalCount: 1500
            };
            wrapper = shallow(<PageHint {...props} />);

            expect(wrapper.find('span').text()).toEqual("Viewing 31 - 40 of 1500");
            expect(wrapper).toMatchSnapshot();
        });
    });

});
