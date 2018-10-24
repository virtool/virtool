import React from "react";
import CX from "classnames";
import PropTypes from "prop-types";
import { Row, Col } from "react-bootstrap";
import AnalysisValueLabel from "../ValueLabel";
import { Flex, FlexItem } from "../../../base/index";

export default class NuVsEntry extends React.Component {
  static propTypes = {
    in: PropTypes.bool,
    index: PropTypes.number,
    sequence: PropTypes.string,
    orfs: PropTypes.array,
    minE: PropTypes.number,
    toggleIn: PropTypes.func
  };

  shouldComponentUpdate(nextProps) {
    return nextProps.in !== this.props.in;
  }

  handleToggleIn = () => {
    if (!this.props.in) {
      this.props.toggleIn(this.props.index);
    }
  };

  render() {
    const className = CX("list-group-item", "spaced", {
      hoverable: !this.props.in
    });

    let closeButton;

    if (this.props.in) {
      closeButton = (
        <FlexItem grow={0} shrink={0}>
          <button
            type="button"
            className="close"
            onClick={() => this.props.toggleIn(this.props.index)}
          >
            <span>×</span>
          </button>
        </FlexItem>
      );
    }

    return (
      <div className={className} onClick={this.handleToggleIn}>
        <Row>
          <Col md={3}>
            <strong>Sequence {this.props.index}</strong>
          </Col>
          <Col md={3}>
            <AnalysisValueLabel
              bsStyle="primary"
              label="Length"
              value={this.props.sequence.length}
            />
          </Col>
          <Col md={3}>
            <AnalysisValueLabel
              bsStyle="danger"
              label="E-value"
              value={this.props.minE}
            />
          </Col>
          <Col md={3}>
            <Flex>
              <FlexItem grow={1} shrink={0}>
                <AnalysisValueLabel
                  bsStyle="success"
                  grow={1}
                  label="ORFs"
                  value={this.props.orfs.length}
                />
              </FlexItem>
              {closeButton}
            </Flex>
          </Col>
        </Row>
      </div>
    );
  }
}
