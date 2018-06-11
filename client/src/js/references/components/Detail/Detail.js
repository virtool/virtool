import React from "react";
import { connect } from "react-redux";
import { Switch, Route, Redirect } from "react-router-dom";
import { push } from "react-router-redux";
import { find } from "lodash-es";
import { LinkContainer } from "react-router-bootstrap";
import { Badge, Nav, NavItem, Dropdown, MenuItem } from "react-bootstrap";
import { LoadingPlaceholder, Icon, ViewHeader, Flex, FlexItem, RelativeTime, ProgressBar } from "../../../base";
import { checkUserRefPermission, followDownload } from "../../../utils";

import { findIndexes } from "../../../indexes/actions";
import { fetchOTUs } from "../../../otus/actions";
import { getReference } from "../../actions";
import EditReference from "./Edit";
import ReferenceManage from "./Manage";
import ReferenceUsers from "./Users";
import ReferenceGroups from "./Groups";
import ReferenceOTUs from "../../../otus/components/List";
import ReferenceIndexList from "../../../indexes/components/List";
import SourceTypes from "../../../administration/components/General/SourceTypes";
import InternalControl from "../../../administration/components/General/InternalControl";

class CustomToggle extends React.Component {
    // Bootstrap Dropdown requires custom dropdown components to be class components
    // in order to use refs.
    render () {
        return (
            <Icon
                name="ellipsis-v"
                tip="Options"
                onClick={this.props.onClick}
                style={{fontSize: "65%", paddingLeft: "5px"}}
            />
        );
    }
}

const ReferenceSettings = ({ isRemote }) => (
    <div className="settings-container">
        {isRemote ? null : <SourceTypes />}
        <InternalControl />
        <ReferenceUsers />
        <ReferenceGroups />
    </div>
);

const getProgress = (detail, processes) => {
    let progress = 0;

    if (detail.process.id && processes.length) {
        const process = find(processes, ["id", detail.process.id]);
        progress = process.progress;
        progress *= 100;
    }

    return progress;
};

class ReferenceDetail extends React.Component {

    componentDidMount () {
        this.props.onGetReference(this.props.match.params.refId);
        this.props.onOTUFirstPage(this.props.match.params.refId, 1);
        this.props.onFindIndexes(this.props.match.params.refId, 1);
    }

    componentDidUpdate (prevProps) {
        if (prevProps.detail === null) {
            return;
        }

        const oldProgress = getProgress(prevProps.detail, prevProps.processes);
        const newProgress = getProgress(this.props.detail, this.props.processes);

        if (oldProgress !== 100 && newProgress === 100) {
            this.props.onGetReference(this.props.match.params.refId);
        }
    }

    handleSelect = (key) => {
        followDownload(`/download/refs/${this.props.match.params.refId}?scope=${key}`);
    }

    render = () => {

        if (this.props.detail === null || this.props.detail.id !== this.props.match.params.refId) {
            return <LoadingPlaceholder />;
        }

        const { name, id, remotes_from, cloned_from, imported_from, created_at, user } = this.props.detail;
        const hasModify = checkUserRefPermission(this.props, "modify");

        let headerIcon;
        let exportButton;

        const disableExport = !!(remotes_from || cloned_from || imported_from);

        if (this.props.pathname === `/refs/${id}/manage`) {
            headerIcon = remotes_from
                ? (
                    <Icon
                        bsStyle="default"
                        name="lock"
                        pullRight
                        style={{fontSize: "65%"}}
                    />
                )
                : null;

            headerIcon = (hasModify && !remotes_from)
                ? (
                    <Icon
                        bsStyle="warning"
                        name="pencil-alt"
                        tip="Edit"
                        onClick={this.props.onEdit}
                        pullRight
                        style={{fontSize: "65%"}}
                    />
                ) : headerIcon;

            exportButton = (
                <Dropdown id="dropdown-export-reference" className="dropdown-export-reference">
                    <CustomToggle bsRole="toggle" />
                    <Dropdown.Menu className="export-ref-dropdown-menu">
                        <MenuItem header>Export</MenuItem>
                        <MenuItem
                            eventKey="built"
                            onSelect={this.handleSelect}
                            disabled={!disableExport}
                        >
                            Built
                        </MenuItem>
                        <MenuItem
                            eventKey="unbuilt"
                            onSelect={this.handleSelect}
                            disabled={!disableExport}
                        >
                            Unbuilt
                        </MenuItem>
                        <MenuItem
                            eventKey="unverified"
                            onSelect={this.handleSelect}
                            disabled={!disableExport}
                        >
                            Unverified
                        </MenuItem>
                    </Dropdown.Menu>
                </Dropdown>
            );
        }

        const referenceHeader = (
            <ViewHeader title={`${name} - References`}>
                <Flex alignItems="flex-end">
                    <FlexItem grow={1}>
                        <Flex>
                            <strong>{name}</strong>
                        </Flex>
                    </FlexItem>
                    {headerIcon}
                    {exportButton}
                </Flex>
                <div className="text-muted" style={{fontSize: "12px"}}>
                    Created <RelativeTime time={created_at} /> by {user.id}
                </div>
            </ViewHeader>
        );

        const progress = getProgress(this.props.detail, this.props.processes);

        if (progress !== 100) {
            return (
                <div>
                    {referenceHeader}
                    <ProgressBar bsStyle="success" now={progress} />
                    <ReferenceManage match={this.props.match} />
                </div>
            );
        }

        return (
            <div className="detail-container">
                {referenceHeader}

                <Nav bsStyle="tabs">
                    <LinkContainer to={`/refs/${id}/manage`}>
                        <NavItem>Manage</NavItem>
                    </LinkContainer>
                    <LinkContainer to={`/refs/${id}/otus`}>
                        <NavItem>OTUs <Badge>{this.props.detail.otu_count}</Badge></NavItem>
                    </LinkContainer>
                    <LinkContainer to={`/refs/${id}/indexes`}>
                        <NavItem>Indexes</NavItem>
                    </LinkContainer>
                    <LinkContainer to={`/refs/${id}/settings`}>
                        <NavItem>Settings</NavItem>
                    </LinkContainer>
                </Nav>

                <Switch>
                    <Redirect from="/refs/:refId" to={`/refs/${id}/manage`} exact />
                    <Route path="/refs/:refId/manage" component={ReferenceManage} />
                    <Route path="/refs/:refId/otus" component={ReferenceOTUs} />
                    <Route path="/refs/:refId/indexes" component={ReferenceIndexList} />
                    <Route path="/refs/:refId/settings" render={() => <ReferenceSettings isRemote={remotes_from} />} />
                </Switch>

                <EditReference />
            </div>
        );
    };
}

const mapStateToProps = state => ({
    detail: state.references.detail,
    pathname: state.router.location.pathname,
    isAdmin: state.account.administrator,
    userId: state.account.id,
    userGroups: state.account.groups,
    refDetail: state.references.detail,
    processes: state.processes.documents
});

const mapDispatchToProps = dispatch => ({

    onGetReference: (refId) => {
        dispatch(getReference(refId));
    },

    onOTUFirstPage: (refId, page) => {
        dispatch(fetchOTUs(refId, page));
    },

    onEdit: () => {
        dispatch(push({...window.location, state: {editReference: true}}));
    },

    onFindIndexes: (refId, page) => {
        dispatch(findIndexes(refId, page));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(ReferenceDetail);
