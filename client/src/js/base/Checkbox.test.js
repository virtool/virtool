import { Checkbox, CheckboxIcon } from "./Checkbox";

describe("<Checkbox />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        wrapper = shallow(<Checkbox />);
        expect(wrapper).toMatchSnapshot();
    });

    it("is clickable when [disabled=falsey]", () => {
        props = {
            disabled: false,
            onClick: jest.fn()
        };
        wrapper = shallow(<Checkbox {...props} />);

        wrapper.find('span').simulate('click');

        expect(props.onClick).toHaveBeenCalled();
    });

    it("displays provided label", () => {
        props = {
            label: "test_label"
        };
        wrapper = shallow(<Checkbox {...props} />);

        expect(wrapper.find('span').length).toEqual(2);
        expect(wrapper.find('span').at(1).text()).toEqual(props.label);

        wrapper = shallow(<Checkbox label="" />);

        expect(wrapper.find('span').length).toEqual(1);
    });

    it("applies given className and style attributes", () => {
        props = {
            className: "tester",
            style: { paddingTop: "100px" },
            disabled: true
        };
        wrapper = shallow(<Checkbox {...props} />);

        const expected = {
            cursor: "not-allowed",
            ...props.style
        };

        expect(wrapper.find('span').hasClass(`pointer text-muted ${props.className}`)).toBe(true);
        expect(wrapper.find('span').prop('style')).toEqual(expected);
        expect(wrapper.find('span').prop('onClick')).toEqual(null);
        expect(wrapper).toMatchSnapshot();
    });

    describe("<CheckboxIcon /> subcomponent", () => {

        it("renders different class names depending on prop values (checked & partial)", () => {
            wrapper = shallow(<CheckboxIcon checked={true} partial={true} />);
            expect(wrapper.find('i').prop('className')).toEqual("i-checkbox-checked");

            wrapper = shallow(<CheckboxIcon checked={true} partial={false} />);
            expect(wrapper.find('i').prop('className')).toEqual("i-checkbox-checked");

            wrapper = shallow(<CheckboxIcon checked={false} partial={true} />);
            expect(wrapper.find('i').prop('className')).toEqual("i-checkbox-partial");

            wrapper = shallow(<CheckboxIcon checked={false} partial={false} />);
            expect(wrapper.find('i').prop('className')).toEqual("i-checkbox-unchecked");
        });

    });

});
