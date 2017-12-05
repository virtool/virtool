/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports AnalysisItem
 */

import React from "react";
import CX from "classnames";
import PropTypes from "prop-types";
import { Row, Col, Label } from "react-bootstrap";

import { getTaskDisplayName } from "../../../utils";
import { Icon, RelativeTime } from "../../../base";

const AnalysisItem = (props) => {

    const itemClass = CX("list-group-item spaced", {
        "hoverable": props.ready
    });

    let end;

    if (props.ready) {
        if (props.canModify) {
            end = <Icon name="remove" bsStyle="danger" onClick={props.onRemove} pullRight/>;
        }
    } else {
        end = (
            <strong className="pull-right">
                In Progress
            </strong>
        )
    }

    return (
        <div className={itemClass} onClick={props.ready ? props.onClick: null}>
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

AnalysisItem.propTypes = {
    index: PropTypes.object,
    user: PropTypes.object,
    algorithm: PropTypes.string,
    created_at: PropTypes.string,
    ready: PropTypes.bool,
    canModify: PropTypes.bool,
    onClick: PropTypes.func,
    onRemove: PropTypes.func
};

export default AnalysisItem;
