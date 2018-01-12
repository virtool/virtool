import React from "react";
import CX from "classnames";
import { ClipLoader } from "halogenium";
import { Row, Col, Label } from "react-bootstrap";

import { getTaskDisplayName } from "../../../utils";
import { Icon, RelativeTime } from "../../../base";

const AnalysisItem = (props) => {

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
                <ClipLoader size="14px" color="#3c8786" style={{display: "inline"}} /> In Progress
            </strong>
        );
    }

    return (
        <div className={itemClass} onClick={props.ready ? props.onClick : null}>
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
    );
};


export default AnalysisItem;
