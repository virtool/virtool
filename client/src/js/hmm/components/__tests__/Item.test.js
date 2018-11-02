import { Col, Row, Label } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";
import { ListGroupItem } from "../../../base/index";
import Item from "../Item";

describe("<HMMItem />", () => {
    const props = {
        cluster: 5,
        families: { None: 3, Family1: 10, Family2: 3, Family3: 7, Family4: 1 },
        id: "tester",
        names: ["string1", "string2", "string3"]
    };

    const wrapper = shallow(<Item {...props} />);

    it("renders without error", () => {
        expect(wrapper).toMatchSnapshot();
    });

    it("renders a LinkContainer component", () => {
        expect(wrapper.find(LinkContainer).exists()).toBe(true);
    });

    it("renders a ListGroupItem child component", () => {
        expect(wrapper.find(ListGroupItem).length).toEqual(1);
    });

    it("renders a Row grandchild component", () => {
        expect(wrapper.find(Row).length).toEqual(1);
    });

    it("renders three Col components", () => {
        expect(wrapper.find(Col).length).toEqual(3);
    });

    it("first Col component displays number of clusters", () => {
        expect(
            wrapper
                .find(Col)
                .at(0)
                .childAt(0)
                .text()
        ).toEqual(`${props.cluster}`);
    });

    it("second Col component displays the first entry in names array", () => {
        expect(
            wrapper
                .find(Col)
                .at(1)
                .childAt(0)
                .text()
        ).toEqual(`${props.names[0]}`);
    });

    it("third Col component displays up to three Label components", () => {
        expect(wrapper.find(Label).length).toEqual(3);
    });
});
