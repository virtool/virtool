import { Flex, FlexItem } from "./Flex";

describe("<Flex />", () => {
    let props;
    let wrapper;

    it("renders correctly", () => {
        const testDiv = <div id="tester" />;
        wrapper = shallow(<Flex>{testDiv}</Flex>);
        const childElement = shallow(testDiv);

        expect(wrapper.children().html()).toEqual(childElement.html());
        expect(wrapper).toMatchSnapshot();
    });

    it("applies given css props to component style", () => {
        props = {
            direction: "row-reverse",
            wrap: "wrap-reverse",
            justifyContent: "center",
            alignItems: "stretch",
            alignContent: "space-between"
        };
        wrapper = shallow(
            <Flex {...props}>
                <div id="tester2" />
            </Flex>
        );

        const expected = {
            display: "flex",
            flexFlow: `${props.direction} ${props.wrap}`,
            justifyContent: "center",
            alignItems: "stretch",
            alignContent: "space-between"
        };

        expect(wrapper.prop("style")).toEqual(expected);
        expect(wrapper).toMatchSnapshot();
    });

    it("applies given style and className props", () => {
        props = {
            children: <div id="tester3" />,
            style: { marginTop: "100px" },
            className: "tester-class"
        };
        wrapper = shallow(<Flex {...props} />);

        const expected = {
            display: "flex",
            flexFlow: "row nowrap",
            justifyContent: "flex-start",
            alignItems: "stretch",
            alignContent: "stretch",
            ...props.style
        };

        expect(wrapper.prop("style")).toEqual(expected);
        expect(wrapper.prop("className")).toEqual(props.className);
        expect(wrapper).toMatchSnapshot();
    });

    describe("<FlexItem />", () => {
        it("renders correctly", () => {
            wrapper = shallow(<FlexItem />);

            expect(wrapper).toMatchSnapshot();
        });

        it("applies given css props to component style", () => {
            props = {
                grow: 1,
                shrink: 1,
                basis: 3,
                alignSelf: "baseline",
                pad: true
            };
            wrapper = shallow(<FlexItem {...props} />);

            const expected = {
                alignSelf: props.alignSelf,
                flex: `${props.grow} ${props.shrink} ${props.basis}`,
                marginLeft: "3px"
            };

            expect(wrapper.prop("style")).toEqual(expected);
            expect(wrapper).toMatchSnapshot();
        });

        it("applies given style and className props", () => {
            props = {
                style: { paddingTop: "100px" },
                className: "tester-class",
                pad: 30
            };
            wrapper = shallow(<FlexItem {...props} />);

            const expected = {
                flex: "0 1 auto",
                alignSelf: null,
                marginLeft: "30px",
                ...props.style
            };

            expect(wrapper.prop("style")).toEqual(expected);
            expect(wrapper.prop("className")).toEqual(props.className);
            expect(wrapper).toMatchSnapshot();
        });
    });
});
