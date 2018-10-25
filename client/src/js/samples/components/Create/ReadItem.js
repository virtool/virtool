import React from "react";
import PropTypes from "prop-types";
import { Row, Col } from "react-bootstrap";

import { byteSize } from "../../../utils";
import { Icon, ListGroupItem } from "../../../base";

export default class ReadItem extends React.PureComponent {
    static propTypes = {
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        size: PropTypes.number.isRequired,
        onSelect: PropTypes.func.isRequired,
        selected: PropTypes.bool
    };

    static defaultProps = {
        selected: false
    };

    onSelect = () => {
        this.props.onSelect(this.props.id);
    };

    render = () => (
        <ListGroupItem onClick={this.onSelect} active={this.props.selected}>
            <Row>
                <Col md={8}>
                    <Icon name="file" /> {this.props.name}
                </Col>
                <Col md={4}>{byteSize(this.props.size)}</Col>
            </Row>
        </ListGroupItem>
    );
}
