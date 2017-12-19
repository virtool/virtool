import React from "react";
import PropTypes from "prop-types";
import { ListGroupItem as BsListGroupItem } from "react-bootstrap";

export class ListGroupItem extends React.Component {

    static propTypes = {
        allowFocus: PropTypes.bool,
        children: PropTypes.node.isRequired
    };

    static defaultProps = {
        allowFocus: false
    };

    render () {
        return (
            <BsListGroupItem {...this.props} onFocus={this.props.allowFocus ? null : e => e.target.blur()}>
                {this.props.children}
            </BsListGroupItem>
        );
    }
}
