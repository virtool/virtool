import React from "react";
import PropTypes from "prop-types";
import { pick } from "lodash-es";
import { ListGroupItem as BsListGroupItem } from "react-bootstrap";

/**
 * Extends the ListGroupItem component from react-bootstrap by adding the allowFocus prop. This prop can prevent the
 * ListGroupItem from taking focus, even when clicked. *
 */
export class ListGroupItem extends React.Component {
  static propTypes = {
    allowFocus: PropTypes.bool,
    children: PropTypes.node.isRequired
  };

  static defaultProps = {
    allowFocus: false
  };

  handleFocus = e => {
    e.target.blur();
  };

  render() {
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
      <BsListGroupItem
        {...props}
        onFocus={this.props.allowFocus ? null : this.handleFocus}
      >
        {this.props.children}
      </BsListGroupItem>
    );
  }
}
