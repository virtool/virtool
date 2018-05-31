import React from "react";
import { map, find, filter } from "lodash-es";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { Link } from "react-router-dom";
import { LinkContainer } from "react-router-bootstrap";
import { Alert, Row, Col, ListGroup, Panel } from "react-bootstrap";

import { Flex, FlexItem, Icon, ListGroupItem, Pagination, ViewHeader, LoadingPlaceholder } from "../../base";
import OTUToolbar from "./Toolbar";
import CreateOTU from "./Create";
import { createFindURL } from "../../utils";

export const checkUserBuildPermission = (props) => {
    const { isAdmin, userId, userGroups, refUsers, refGroups } = props;

    if (isAdmin) {
        return true;
    }

    const userExists = find(refUsers, ["id", userId]);

    const groupsExist = filter(refGroups, refGroup => {
        const result = filter(userGroups, group => group === refGroup.id);
        return result;
    });

    if (userExists && userExists.build) {
        return true;
    }

    if (groupsExist.length) {
        const hasBuildPermission = filter(groupsExist, group => group.build);
        return !!hasBuildPermission.length;
    }

    return false;
};

const OTUItem = ({ refId, abbreviation, id, name, modified, verified }) => (
    <LinkContainer to={`/refs/${refId}/otus/${id}`} key={id} className="spaced">
        <ListGroupItem bsStyle={verified ? null : "warning"}>
            <Row>
                <Col xs={11} md={7}>
                    <strong>{name}</strong>
                    <small className="hidden-md hidden-lg text-muted" style={{marginLeft: "5px"}}>
                        {abbreviation}
                    </small>
                </Col>
                <Col xsHidden md={4}>
                    {abbreviation}
                </Col>
                <Col xs={1} md={1}>
                    <span className="pull-right">
                        {modified ? <Icon bsStyle="warning" name="flag" /> : null}
                    </span>
                </Col>
                {verified ? null : <Icon name="tag" pullRight tip="This OTU is unverified" />}
            </Row>
        </ListGroupItem>
    </LinkContainer>
);

const OTUsList = (props) => {

    let OTUComponents;

    if (props.documents === null) {
        return <div />;
    }

    const OTUCount = props.documents.length;

    if (OTUCount) {
        OTUComponents = map(props.documents, document =>
            <OTUItem key={document.id} refId={props.refId} {...document} />
        );
    } else {
        OTUComponents = (
            <ListGroupItem key="noOTUs" className="text-center">
                <span>
                    <Icon name="info" /> No OTUs found,
                </span>
                <span> <Link to={{state: {createOTU: true}}}>create</Link> some.</span>
            </ListGroupItem>
        );
    }

    const hasPermission = checkUserBuildPermission(props);

    let alert;

    if (props.unbuiltChangeCount && hasPermission) {
        alert = (
            <Alert bsStyle="warning">
                <Flex alignItems="center">
                    <Icon name="info" />
                    <FlexItem pad={5}>
                        <span>The OTU database has changed. </span>
                        <Link to={`/refs/${props.refId}/indexes`}>Rebuild the index</Link>
                        <span> to use the changes in further analyses.</span>
                    </FlexItem>
                </Flex>
            </Alert>
        );
    }

    const importProgress = props.process ? find(props.processes, { id: props.process.id }).progress : 1;

    if (importProgress < 1) {
        return (
            <Panel>
                <Panel.Body>
                    <LoadingPlaceholder message="Import in progress" margin="1.2rem" />
                </Panel.Body>
            </Panel>
        );
    }

    return (
        <div>
            <ViewHeader
                page={props.page}
                count={OTUCount}
                foundCount={props.found_count}
            />

            {alert}

            <OTUToolbar />

            <ListGroup>
                {OTUComponents}
            </ListGroup>

            <Pagination
                documentCount={OTUCount}
                onPage={props.onPage}
                page={props.page}
                pageCount={props.page_count}
            />

            <CreateOTU {...props} />
        </div>
    );
};


const mapStateToProps = state => ({
    ...state.otus,
    refId: state.references.detail.id,
    process: state.references.detail.process,
    processes: state.processes.documents,
    unbuiltChangeCount: state.references.detail.unbuilt_change_count,
    isAdmin: state.account.administrator,
    userId: state.account.id,
    userGroups: state.account.groups,
    refUsers: state.references.detail.users,
    refGroups: state.references.detail.groups
});

const mapDispatchToProps = (dispatch) => ({

    onPage: (page) => {
        const url = createFindURL({ page });
        dispatch(push(url.pathname + url.search));
    },

    onHide: () => {
        dispatch(push({state: {createOTU: false}}));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(OTUsList);
