import { Radio } from "./Radio";
import { Flex, FlexItem, Icon } from "./index";

describe("<Radio />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        props = {
            checked: false
        };
        let wrapper = shallow(<Radio {...props} />);

        expect(wrapper).toMatchSnapshot();
    });

    it("renders a Flex component containing an Icon and a FlexItem component", () => {
        props = {
            checked: true,
            label: "test label",
            onClick: jest.fn()
        };
        let wrapper = shallow(<Radio {...props} />);

        expect(wrapper.find(Flex).length).toEqual(1);
        expect(wrapper.find(Flex).children().length).toEqual(2);
        expect(wrapper.find(Icon).length).toEqual(1);
        expect(wrapper.find(FlexItem).length).toEqual(1);

        expect(wrapper).toMatchSnapshot();
    });

    describe("Icon subcomponent", () => {

        it("is clickable", () => {
            props = {
                checked: true,
                onClick: jest.fn()
            };
            let wrapper = shallow(<Radio {...props} />);

            wrapper.find(Icon).simulate('click');

            expect(props.onClick).toHaveBeenCalled();
            expect(wrapper).toMatchSnapshot();
        });

        it("if checked, [name='radio-checked']", () => {
            props = {
                checked: true
            };
            let wrapper = shallow(<Radio {...props} />);

            expect(wrapper.find(Icon).prop('name')).toEqual("radio-checked");
            expect(wrapper).toMatchSnapshot();
        });

        it("otherwise [name='radio-unchecked']", () => {
            props = {
                checked: false
            };
            let wrapper = shallow(<Radio {...props} />);

            expect(wrapper.find(Icon).prop('name')).toEqual("radio-unchecked");
            expect(wrapper).toMatchSnapshot();
        })

    });

    describe("FlexItem subcomponent", () => {

        it("displays provided label", () => {
            props = {
                checked: false,
                label: "tester"
            };
            let wrapper = shallow(<Radio {...props} />);

            expect(wrapper.find('span').text()).toEqual(` ${props.label}`);
            expect(wrapper).toMatchSnapshot();
        });

        it("when no label provided, empty component (null)", () => {
            props = {
                checked: false
            };
            let wrapper = shallow(<Radio {...props} />);

            expect(wrapper.find(FlexItem).children().length).toEqual(0);
            expect(wrapper).toMatchSnapshot();
        });

    });

});
