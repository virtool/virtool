import React from "react";
import PropTypes from "prop-types";
import { Col } from "react-bootstrap";
import { Checkbox, ListGroupItem } from "../../base";

export class UserGroup extends React.Component {
    static propTypes = {
        id: PropTypes.string.isRequired,
        toggled: PropTypes.bool.isRequired,
        onClick: PropTypes.func.isRequired
    };

    handleClick = () => {
        this.props.onClick(this.props.id);
    };

    render() {
        return (
            <Col xs={12} md={4}>
                <ListGroupItem className="text-capitalize" onClick={this.handleClick}>
                    {this.props.id}
                    <Checkbox checked={this.props.toggled} pullRight />
                </ListGroupItem>
            </Col>
        );
    }
}
