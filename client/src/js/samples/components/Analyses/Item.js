import React from "react";
import CX from "classnames";
import { connect } from "react-redux";
import { ClipLoader } from "halogenium";
import { Row, Col, Label } from "react-bootstrap";

import { getTaskDisplayName } from "../../../utils";
import { Icon, RelativeTime } from "../../../base";
import { removeAnalysis } from "../../actions";
import { getCanModify } from "../../selectors";

export class AnalysisItem extends React.Component {

    render () {

        const itemClass = CX("list-group-item spaced", {hoverable: this.props.ready});

        let end;

        if (this.props.ready) {
            if (this.props.canModify) {
                end = (
                    <Icon
                        name="remove"
                        bsStyle="danger"
                        onClick={() => this.props.onRemove(this.props.id)}
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
            <div className={itemClass} onClick={this.props.ready ? this.props.onRemove : null}>
                <Row>
                    <Col md={3}>
                        <strong>{getTaskDisplayName(this.props.algorithm)}</strong>
                    </Col>
                    <Col md={4}>
                        Started <RelativeTime time={this.props.created_at}/> by {this.props.user.id}
                    </Col>
                    <Col md={1}>
                        <Label>{this.props.index.version}</Label>
                    </Col>
                    <Col md={4}>
                        {end}
                    </Col>
                </Row>
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    canModify: getCanModify(state)
});

const mapDispatchToProps = (dispatch, ownProps) => ({
    onRemove: () => {
        dispatch(removeAnalysis(ownProps.id));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(AnalysisItem);
