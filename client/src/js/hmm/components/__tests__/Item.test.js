import { Col, Row, Label } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";
import { ListGroupItem } from "../../../base/index";
import Item from "../Item";

describe("<HMMItem />", () => {
    it("should render", () => {
        const props = {
            cluster: 5,
            families: { None: 3, Family1: 10, Family2: 3, Family3: 7, Family4: 1 },
            id: "tester",
            names: ["string1", "string2", "string3"]
        };

        const wrapper = shallow(<Item {...props} />);
        expect(wrapper).toMatchSnapshot();
    });
});
