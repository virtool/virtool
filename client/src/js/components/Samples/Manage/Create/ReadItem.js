import React from "react";
import Numeral from "numeral";
import { Row, Col } from "react-bootstrap";
import { Icon, ListGroupItem } from "virtool/js/components/Base";

const ReadItem = (props) => (
    <ListGroupItem onClick={() => props.onSelect(props._id)} active={props.selected}>
        <Row>
            <Col md={8}>
                <Icon name="file" /> {props.name}
            </Col>
            <Col md={4}>
                {Numeral(props.size_end).format(" 0.0 b")}
            </Col>
        </Row>
    </ListGroupItem>
);

ReadItem.propTypes = {
    _id: React.PropTypes.string.isRequired,
    name: React.PropTypes.string.isRequired,
    size_end: React.PropTypes.number.isRequired,
    onSelect: React.PropTypes.func.isRequired,
    selected: React.PropTypes.bool
};

ReadItem.defaultProps = {
    selected: false
};

export default ReadItem;
