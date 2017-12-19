import React from "react";
import PropTypes from "prop-types";
import { pick } from "lodash";
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

        const props = pick(this.props, [
            "active",
            "style",
            "className",
            "bsStyle",
            "disabled",
            "header",
            "href",
            "onClick",
            "type"
        ]);

        return (
            <BsListGroupItem {...props} onFocus={this.props.allowFocus ? null : e => e.target.blur()}>
                {this.props.children}
            </BsListGroupItem>
        );
    }
}
