import React from "react";
import { map } from "lodash-es";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { Link } from "react-router-dom";
import { LinkContainer } from "react-router-bootstrap";
import { Alert, Row, Col, ListGroup } from "react-bootstrap";

import { Flex, FlexItem, Icon, ListGroupItem, Pagination, ViewHeader } from "../../base";
import VirusToolbar from "./Toolbar";
import CreateVirus from "./Create";
import VirusImport from "./Import";
import { createFindURL } from "../../utils";

const VirusItem = ({ abbreviation, id, name, modified, verified }) => (
    <LinkContainer to={`/viruses/${id}`} key={id} className="spaced">
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
                {verified ? null : <Icon name="tag" pullRight tip="This virus is unverified" />}
            </Row>
        </ListGroupItem>
    </LinkContainer>
);

const VirusesList = (props) => {

    let virusComponents;

    if (props.documents === null) {
        return <div />;
    }

    const virusCount = props.documents.length;

    if (virusCount) {
        virusComponents = map(props.documents, document => <VirusItem key={document.id} {...document} />);
    } else {
        virusComponents = (
            <ListGroupItem key="noViruses" className="text-center">
                <span>
                    <Icon name="info" /> No viruses found. <Link to={{state: {virusImport: true}}}>Import</Link> or
                </span>
                <span> <Link to={{state: {createVirus: true}}}>Create</Link> some</span>
            </ListGroupItem>
        );
    }

    let alert;

    if (props.modified_count) {
        alert = (
            <Alert bsStyle="warning">
                <Flex alignItems="center">
                    <Icon name="info" />
                    <FlexItem pad={5}>
                        <span>The virus database has changed. </span>
                        <Link to="/viruses/indexes">Rebuild the index</Link>
                        <span> to use the changes in further analyses.</span>
                    </FlexItem>
                </Flex>
            </Alert>
        );
    }

    return (
        <div>
            <ViewHeader
                title="Viruses"
                page={props.page}
                count={virusCount}
                foundCount={props.found_count}
                totalCount={props.total_count}
            />

            {alert}

            <VirusToolbar />

            <ListGroup>
                {virusComponents}
            </ListGroup>

            <Pagination
                documentCount={virusCount}
                onPage={props.onPage}
                page={props.page}
                pageCount={props.page_count}
            />

            <CreateVirus {...props} />

            <VirusImport />
        </div>
    );
};

const mapStateToProps = state => ({
    ...state.viruses,
    account: state.account
});

const mapDispatchToProps = (dispatch) => ({

    onPage: (page) => {
        const url = createFindURL({ page });
        dispatch(push(url.pathname + url.search));
    },

    onHide: () => {
        dispatch(push({state: {createVirus: false}}));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(VirusesList);
