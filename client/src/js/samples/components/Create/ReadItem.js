import React from "react";
import { Row, Col } from "react-bootstrap";

import { byteSize } from "virtool/js/utils";
import { Icon, ListGroupItem } from "virtool/js/components/Base";

export default class ReadItem extends React.PureComponent {

    static propTypes = {
        id: React.PropTypes.string.isRequired,
        name: React.PropTypes.string.isRequired,
        size: React.PropTypes.number.isRequired,
        onSelect: React.PropTypes.func.isRequired,
        selected: React.PropTypes.bool
    };

    static defaultProps = {
        selected: false
    };

    render = () => (
        <ListGroupItem onClick={() => this.props.onSelect(this.props.id)} active={this.props.selected}>
            <Row>
                <Col md={8}>
                    <Icon name="file" /> {this.props.name}
                </Col>
                <Col md={4}>
                    {byteSize(this.props.size)}
                </Col>
            </Row>
        </ListGroupItem>
    );
}
