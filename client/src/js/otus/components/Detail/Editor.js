/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * exports Isolates
 */

import React from "react";
import { map } from "lodash-es";
import { connect } from "react-redux";
import { withRouter } from "react-router-dom";
import { Badge, Row, Col, ListGroup } from "react-bootstrap";

import { formatIsolateName } from "../../../utils";
import { selectIsolate, showAddIsolate } from "../../actions";
import { FlexItem, Icon, ListGroupItem, NoneFound } from "../../../base";
import IsolateDetail from "./IsolateDetail";

export class IsolateButton extends React.Component {

    handleSelectIsolate = () => {
        this.props.onClick(this.props.id);
    };

    render () {
        return (
            <ListGroupItem className="isolate-item" active={this.props.active} onClick={this.handleSelectIsolate}>
                <div className="isolate-item-name">
                    <span>{formatIsolateName(this.props)}</span>
                </div>
                <div className="isolate-item-icon">
                    <span>{this.props.default ? <Icon className="pull-right" name="star" /> : null}</span>
                </div>
            </ListGroupItem>
        );
    }
}

const IsolateEditor = (props) => {

    const isolateComponents = map(props.isolates, (isolate, index) =>
        <IsolateButton
            key={index}
            {...isolate}
            active={isolate.id === props.activeIsolateId}
            onClick={props.onSelectIsolate}
        />
    );

    let noIsolatesFound;

    if (!isolateComponents.length) {
        noIsolatesFound = (
            <Col md={12}>
                <NoneFound noun="isolates" />
            </Col>
        );
    }

    return (
        <div>
            <h4 style={{display: "flex", alignItems: "center"}} className="section-header">
                <FlexItem grow={0} shrink={0}>
                    <strong>
                        Isolates
                    </strong>
                </FlexItem>

                <FlexItem grow={1} pad={5}>
                    <Badge>
                        {isolateComponents.length}
                    </Badge>
                </FlexItem>

                {props.canModify ? (
                    <Icon
                        bsStyle="primary"
                        name="new-entry"
                        tip="Add Isolate"
                        style={{fontSize: "15px"}}
                        onClick={props.onShowAddIsolate}
                    />
                ) : null}
            </h4>

            <Row>
                {noIsolatesFound}
                <Col md={3}>
                    <ListGroup style={{height: "100%"}}>
                        {isolateComponents}
                    </ListGroup>
                </Col>
                <Col md={9}>
                    {noIsolatesFound ? null : <IsolateDetail />}
                </Col>
            </Row>
        </div>
    );
};

const mapStateToProps = state => ({
    OTUId: state.OTUs.detail.id,
    isolates: state.OTUs.detail.isolates,
    activeIsolateId: state.OTUs.activeIsolateId,
    canModify: state.account.permissions.modify_OTU
});

const mapDispatchToProps = dispatch => ({

    onSelectIsolate: (isolateId) => {
        dispatch(selectIsolate(isolateId));
    },

    onShowAddIsolate: () => {
        dispatch(showAddIsolate());
    }

});

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(IsolateEditor));
