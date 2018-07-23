import React from "react";
import { find } from "lodash-es";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { Link } from "react-router-dom";
import { LinkContainer } from "react-router-bootstrap";
import { Alert, Row, Col, Panel } from "react-bootstrap";
import {
    Flex,
    FlexItem,
    Icon,
    ListGroupItem,
    LoadingPlaceholder,
    ScrollList,
    NoneFound
} from "../../base";
import OTUToolbar from "./Toolbar";
import CreateOTU from "./Create";
import { checkUserRefPermission } from "../../utils";
import { listOTUs } from "../actions";

const OTUItem = ({ refId, abbreviation, id, name, verified }) => (
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
                {verified ? null : <Icon name="tag" pullRight tip="This OTU is unverified" />}
            </Row>
        </ListGroupItem>
    </LinkContainer>
);

class OTUsList extends React.Component {

    componentDidMount () {
        if (!this.props.fetched) {
            this.props.loadNextPage(this.props.refId, 1);
        }
    }

    handleNextPage = (page) => {
        this.props.loadNextPage(this.props.refId, page);
    };

    rowRenderer = (index) => (
        <OTUItem
            key={this.props.documents[index].id}
            refId={this.props.refId}
            {...this.props.documents[index]}
        />
    );

    render () {

        if (this.props.documents === null) {
            return <LoadingPlaceholder />;
        }

        let noOTUs;

        if (!this.props.documents.length) {
            noOTUs = <NoneFound noun="otus" />;
        }

        const hasBuild = checkUserRefPermission(this.props, "build");
        const hasRemoveOTU = checkUserRefPermission(this.props, "modify_otu");
        let alert;

        if (this.props.unbuiltChangeCount && hasBuild) {
            alert = (
                <Alert bsStyle="warning">
                    <Flex alignItems="center">
                        <Icon name="info-circle" />
                        <FlexItem pad={5}>
                            <span>The OTU database has changed. </span>
                            <Link to={`/refs/${this.props.refId}/indexes`}>Rebuild the index</Link>
                            <span> to use the changes in further analyses.</span>
                        </FlexItem>
                    </Flex>
                </Alert>
            );
        }

        const importProgress = this.props.process
            ? find(this.props.processes, { id: this.props.process.id }).progress
            : 1;

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
                {alert}

                <OTUToolbar hasRemoveOTU={hasRemoveOTU} refId={this.props.refId} />

                <CreateOTU {...this.props} />

                {noOTUs}

                <ScrollList
                    hasNextPage={this.props.page < this.props.page_count}
                    isNextPageLoading={this.props.isLoading}
                    isLoadError={this.props.errorLoad}
                    list={this.props.documents}
                    refetchPage={this.props.refetchPage}
                    loadNextPage={this.handleNextPage}
                    page={this.props.page}
                    rowRenderer={this.rowRenderer}
                />
            </div>
        );
    }
}

const mapStateToProps = state => ({
    ...state.otus,
    refId: state.references.detail.id,
    process: state.references.detail.process,
    processes: state.processes.documents,
    unbuiltChangeCount: state.references.detail.unbuilt_change_count,
    isAdmin: state.account.administrator,
    userId: state.account.id,
    userGroups: state.account.groups,
    detail: state.references.detail
});

const mapDispatchToProps = (dispatch) => ({

    onHide: () => {
        dispatch(push({state: {createOTU: false}}));
    },

    loadNextPage: (refId, page) => {
        dispatch(listOTUs(refId, page));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(OTUsList);
