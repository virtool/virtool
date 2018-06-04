import React from "react";
import { map, find } from "lodash-es";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { Link } from "react-router-dom";
import { LinkContainer } from "react-router-bootstrap";
import { Alert, Row, Col, Panel } from "react-bootstrap";
import { CellMeasurer, CellMeasurerCache } from "react-virtualized";

import {
    Flex,
    FlexItem,
    Icon,
    ListGroupItem,
    Pagination,
    ViewHeader,
    LoadingPlaceholder,
    ScrollList
} from "../../base";
import OTUToolbar from "./Toolbar";
import CreateOTU from "./Create";
import { createFindURL, checkUserRefPermission } from "../../utils";

import { fetchOTUs } from "../actions";

const cache = new CellMeasurerCache({
    fixedWidth: true,
    defaultHeight: 100
});

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

class OTUsList extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            masterList: this.props.documents,
            list: this.props.documents,
            page: this.props.page
        };
    }

    static getDerivedStateFromProps (nextProps, prevState) {

        if (prevState.masterList === null && nextProps.documents) {
            return {
                masterList: nextProps.documents,
                list: nextProps.documents,
                page: nextProps.page
            };
        }

        if (prevState.list !== nextProps.documents) {
            return {
                masterList: prevState.masterList.concat(nextProps.documents),
                list: nextProps.documents,
                page: prevState.page + 1
            };
        }

        return null;
    }

    rowRenderer = ({ index, key, style, parent }) => {
        return (
            <CellMeasurer
                key={key}
                cache={cache}
                parent={parent}
                columnIndex={0}
                rowIndex={index}
            >
                <div style={style} className="infinite-scroll-row">
                    <OTUItem
                        key={this.state.masterList[index].id}
                        refId={this.props.refId}
                        {...this.state.masterList[index]}
                    />
                </div>
            </CellMeasurer>
        );
    };

    render () {

        let OTUComponents;

        if (this.props.documents === null) {
            return <div />;
        }

        const OTUCount = this.props.documents.length;

        if (OTUCount) {
            OTUComponents = map(this.props.documents, document =>
                <OTUItem key={document.id} refId={this.props.refId} {...document} />
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

        const hasBuild = checkUserRefPermission(this.props, "build");
        const hasRemoveOTU = checkUserRefPermission(this.props, "modify_otu");
        let alert;

        if (this.props.unbuiltChangeCount && hasBuild) {
            alert = (
                <Alert bsStyle="warning">
                    <Flex alignItems="center">
                        <Icon name="info" />
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
            <div className="inner-list-container">
                <ViewHeader
                    page={this.props.page}
                    count={OTUCount}
                    foundCount={this.props.found_count}
                />

                {alert}

                <OTUToolbar hasRemoveOTU={hasRemoveOTU} />

                <CreateOTU {...this.props} />

                <ScrollList
                    hasNextPage={this.props.page < this.props.page_count}
                    isNextPageLoading={this.props.isLoading}
                    list={this.state.masterList}
                    loadNextPage={() => this.props.loadNextPage(this.state.page)}
                    page={this.props.page}
                    rowRenderer={this.rowRenderer}
                    cache={cache}
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

    onPage: (page) => {
        const url = createFindURL({ page });
        dispatch(push(url.pathname + url.search));
    },

    onHide: () => {
        dispatch(push({state: {createOTU: false}}));
    },

    loadNextPage: (page) => {
        dispatch(fetchOTUs(page));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(OTUsList);
