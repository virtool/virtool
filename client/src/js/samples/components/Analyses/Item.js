import React from "react";
import CX from "classnames";
import { get } from "lodash";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { ClipLoader } from "halogenium";
import { Row, Col, Label } from "react-bootstrap";

import { getTaskDisplayName } from "../../../utils";
import { Icon, RelativeTime } from "../../../base";
import { removeAnalysis } from "../../actions";
import { getCanModify } from "../../selectors";

export const AnalysisItem = (props) => {

    const itemClass = CX("list-group-item spaced", {hoverable: props.ready});

    let end;

    if (props.ready) {
        if (props.canModify) {
            end = (
                <Icon
                    name="remove"
                    bsStyle="danger"
                    onClick={() => props.onRemove(props.id)}
                    style={{fontSize: "17px"}}
                    pullRight
                />
            );
        }
    } else {
        end = (
            <strong className="pull-right">
                <ClipLoader size="14px" color="#3c8786" style={{display: "inline"}}/> In Progress
            </strong>
        );
    }

    return (
        <LinkContainer to={`/samples/${props.sampleId}/analyses/${props.id}`}>
            <div className={itemClass}>
                <Row>
                    <Col md={3}>
                        <strong>{getTaskDisplayName(props.algorithm)}</strong>
                    </Col>
                    <Col md={4}>
                        Started <RelativeTime time={props.created_at}/> by {props.user.id}
                    </Col>
                    <Col md={1}>
                        <Label>{props.index.version}</Label>
                    </Col>
                    <Col md={4}>
                        {end}
                    </Col>
                </Row>
            </div>
        </LinkContainer>
    );
};

const mapStateToProps = (state) => ({
    sampleId: get(state.samples.detail, "id"),
    canModify: getCanModify(state)
});

const mapDispatchToProps = (dispatch, ownProps) => ({
    onRemove: () => {
        dispatch(removeAnalysis(ownProps.id));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(AnalysisItem);
