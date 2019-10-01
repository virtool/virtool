import { get, map } from "lodash-es";
import React from "react";
import styled from "styled-components";
import { Col, ListGroup, Row } from "react-bootstrap";
import { connect } from "react-redux";
import { withRouter } from "react-router-dom";
import { Badge, FlexItem, Icon, ListGroupItem, NoneFound } from "../../../base";

import { checkRefRight, formatIsolateName } from "../../../utils/utils";
import { selectIsolate, showAddIsolate } from "../../actions";
import IsolateDetail from "./IsolateDetail";

export class IsolateButton extends React.Component {
    handleSelectIsolate = () => {
        this.props.onClick(this.props.id);
    };

    render() {
        return (
            <ListGroupItem className="isolate-item" active={this.props.active} onClick={this.handleSelectIsolate}>
                <div className="isolate-item-name">
                    <span>{formatIsolateName(this.props)}</span>
                </div>
                <div className="isolate-item-icon">
                    <span>
                        {this.props.default ? (
                            <Icon className="pull-right" name="star" tip="Set as Default" tipPlacement="left" />
                        ) : null}
                    </span>
                </div>
            </ListGroupItem>
        );
    }
}

const StyledIsolateEditor = styled.div`
    h4 > a {
        font-size: 14px;
    }
`;

const IsolateEditor = props => {
    const isolateComponents = map(props.isolates, (isolate, index) => (
        <IsolateButton
            key={index}
            {...isolate}
            active={isolate.id === props.activeIsolateId}
            onClick={props.onSelectIsolate}
        />
    ));

    let noIsolatesFound;

    if (!isolateComponents.length) {
        noIsolatesFound = (
            <Col md={12}>
                <NoneFound noun="isolates" />
            </Col>
        );
    }

    return (
        <StyledIsolateEditor>
            <h4 style={{ display: "flex", alignItems: "center" }} className="section-header">
                <FlexItem grow={0} shrink={0}>
                    <strong>Isolates</strong>
                </FlexItem>

                <FlexItem grow={1} pad={5}>
                    <Badge>{isolateComponents.length}</Badge>
                </FlexItem>

                {props.canModify ? (
                    <a href="#" onClick={props.onShowAddIsolate}>
                        Add Isolate
                    </a>
                ) : null}
            </h4>

            <Row>
                {noIsolatesFound}
                <Col md={3}>
                    <ListGroup style={{ height: "100%" }}>{isolateComponents}</ListGroup>
                </Col>
                <Col md={9}>{noIsolatesFound ? null : <IsolateDetail canModify={props.canModify} />}</Col>
            </Row>
        </StyledIsolateEditor>
    );
};

const mapStateToProps = state => ({
    otuId: state.otus.detail.id,
    isolates: state.otus.detail.isolates,
    activeIsolateId: state.otus.activeIsolateId,
    isRemote: state.references.detail.remotes_from,
    canModify: !get(state, "references.detail.remotes_from") && checkRefRight(state, "modify_otu")
});

const mapDispatchToProps = dispatch => ({
    onSelectIsolate: isolateId => {
        dispatch(selectIsolate(isolateId));
    },

    onShowAddIsolate: () => {
        dispatch(showAddIsolate());
    }
});

export default withRouter(
    connect(
        mapStateToProps,
        mapDispatchToProps
    )(IsolateEditor)
);
