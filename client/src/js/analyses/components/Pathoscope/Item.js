import CX from "classnames";
import React from "react";
import { Col, Row } from "react-bootstrap";
import { connect } from "react-redux";
import { Flex, FlexItem } from "../../../base/index";
import { toScientificNotation } from "../../../utils";
import { toggleExpanded } from "../../actions";
import AnalysisValueLabel from "../ValueLabel";

export const PathoscopeItem = props => {
  const className = CX("list-group-item", "spaced", {
    hoverable: !props.expanded
  });

  let closeButton;

  if (props.expanded) {
    closeButton = (
      <button
        type="button"
        className="close pull-right"
        onClick={() => props.onExpand(props.id)}
      >
        <span>×</span>
      </button>
    );
  }

  const piValue = props.showReads
    ? Math.round(props.reads)
    : toScientificNotation(props.pi);

  return (
    <div
      className={className}
      onClick={props.expanded ? null : () => props.onExpand(props.id)}
    >
      <Row>
        <Col xs={12} sm={5} md={5}>
          <Flex>
            <FlexItem>{props.name}</FlexItem>
            <FlexItem pad={5}>
              <small className="text-primary">
                <strong className="text-warning">{props.abbreviation}</strong>
              </small>
            </FlexItem>
          </Flex>
        </Col>
        <Col xs={4} sm={2} md={2}>
          <AnalysisValueLabel
            bsStyle="success"
            label={props.showReads ? "Reads" : "Weight"}
            value={piValue}
          />
        </Col>
        <Col xs={3} sm={2} md={2}>
          <AnalysisValueLabel
            bsStyle="danger"
            label="Depth"
            value={props.depth.toFixed(1)}
          />
        </Col>
        <Col xs={3} sm={2} md={2}>
          <AnalysisValueLabel
            bsStyle="primary"
            label="Coverage"
            value={props.coverage.toFixed(3)}
          />
        </Col>
        <Col xs={2} sm={1} md={1}>
          {closeButton}
        </Col>
      </Row>
    </div>
  );
};

const mapStateToProps = (state, ownProps) => ({
  ...state.analyses.data[ownProps.index],
  showMedian: state.analyses.showMedian,
  showReads: state.analyses.showReads
});

const mapDispatchToProps = dispatch => ({
  onExpand: id => {
    dispatch(toggleExpanded(id));
  }
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(PathoscopeItem);
