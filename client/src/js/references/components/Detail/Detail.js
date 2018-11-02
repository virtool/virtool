import React from "react";
import { connect } from "react-redux";
import { Switch, Route, Redirect } from "react-router-dom";
import { push } from "react-router-redux";
import { find, get } from "lodash-es";
import { LinkContainer } from "react-router-bootstrap";
import { Badge, Nav, NavItem, Dropdown, MenuItem, ProgressBar as BSProgressBar } from "react-bootstrap";
import {
    LoadingPlaceholder,
    Icon,
    ViewHeader,
    Flex,
    FlexItem,
    RelativeTime,
    ProgressBar,
    NotFound
} from "../../../base";
import { checkRefRight, followDownload } from "../../../utils/utils";
import { getReference } from "../../actions";
import OTUList from "../../../otus/components/List";
import IndexList from "../../../indexes/components/List";
import SourceTypes from "../SourceTypes";
import InternalControl from "./InternalControl";
import ReferenceMembers from "./Members";
import ReferenceManage from "./Manage";
import EditReference from "./Edit";

class CustomToggle extends React.Component {
    // Bootstrap Dropdown requires custom dropdown components to be class components
    // in order to use refs.
    render() {
        return (
            <Icon
                name="ellipsis-v"
                tip="Options"
                onClick={this.props.onClick}
                style={{ fontSize: "65%", paddingLeft: "5px" }}
            />
        );
    }
}

const ReferenceSettings = ({ isRemote }) => (
    <div className="settings-container">
        {isRemote ? null : <SourceTypes />}
        <InternalControl global />
        <ReferenceMembers noun="users" />
        <ReferenceMembers noun="groups" />
    </div>
);

const isRemoteUpdate = (detail, processes) => {
    if (!detail || !detail.process || !processes.length) {
        return false;
    }

    const process = find(processes, ["id", detail.process.id]);

    if (!process) {
        return false;
    }

    return process.type === "update_remote_reference";
};

const getProgress = (detail, processes) => {
    let progress = 0;

    if (!detail || !detail.process) {
        return 100;
    }

    if (detail.process.id && processes.length) {
        const process = find(processes, ["id", detail.process.id]);
        progress = process ? process.progress : 1;
        progress *= 100;
    }

    return progress;
};

class ReferenceDetail extends React.Component {
    componentDidMount() {
        this.props.onGetReference(this.props.match.params.refId);
    }

    componentDidUpdate(prevProps) {
        if (prevProps.detail === null) {
            return;
        }

        const oldProgress = getProgress(prevProps.detail, prevProps.processes);
        const newProgress = getProgress(this.props.detail, this.props.processes);

        if (oldProgress !== 100 && newProgress === 100) {
            this.props.onGetReference(this.props.match.params.refId);
            this.props.onListIndexes(this.props.match.params.refId, 1);
            this.props.onListOTUs(this.props.match.params.refId, 1);
        }
    }

    handleSelect = key => {
        followDownload(`/download/refs/${this.props.match.params.refId}?scope=${key}`);
    };

    render = () => {
        if (this.props.error) {
            return <NotFound />;
        }

        if (this.props.detail === null || this.props.detail.id !== this.props.match.params.refId) {
            return <LoadingPlaceholder />;
        }

        const { name, id, remotes_from, cloned_from, imported_from, created_at, user } = this.props.detail;

        let headerIcon;
        let exportButton;

        const disableExport = !!(remotes_from || cloned_from || imported_from);

        if (this.props.pathname === `/refs/${id}/manage`) {
            headerIcon = remotes_from ? (
                <Icon bsStyle="default" name="lock" pullRight style={{ fontSize: "65%" }} />
            ) : null;

            headerIcon =
                this.props.canModify && !remotes_from ? (
                    <Icon
                        bsStyle="warning"
                        name="pencil-alt"
                        tip="Edit"
                        onClick={this.props.onEdit}
                        pullRight
                        style={{ fontSize: "65%" }}
                    />
                ) : (
                    headerIcon
                );

            exportButton = (
                <Dropdown id="dropdown-export-reference" className="dropdown-export-reference">
                    <CustomToggle bsRole="toggle" />
                    <Dropdown.Menu className="export-ref-dropdown-menu">
                        <MenuItem header>Export</MenuItem>
                        <MenuItem eventKey="built" onSelect={this.handleSelect} disabled={!disableExport}>
                            Built
                        </MenuItem>
                        <MenuItem eventKey="unbuilt" onSelect={this.handleSelect} disabled={!disableExport}>
                            Unbuilt
                        </MenuItem>
                        <MenuItem eventKey="unverified" onSelect={this.handleSelect} disabled={!disableExport}>
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
                <div className="text-muted" style={{ fontSize: "12px" }}>
                    Created <RelativeTime time={created_at} /> by {user.id}
                </div>
            </ViewHeader>
        );

        const progress = getProgress(this.props.detail, this.props.processes);
        const isUpdatingRemote = isRemoteUpdate(this.props.detail, this.props.processes);

        if (this.props.processes.length && progress !== 100) {
            return (
                <div>
                    {referenceHeader}
                    {isUpdatingRemote ? (
                        <BSProgressBar>
                            <BSProgressBar bsStyle="warning" now={50} />
                            <BSProgressBar bsStyle="success" now={progress / 2} />
                        </BSProgressBar>
                    ) : (
                        <ProgressBar bsStyle="warning" now={progress} />
                    )}
                    <ReferenceManage match={this.props.match} isUpdating={isUpdatingRemote} />
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
                        <NavItem>
                            OTUs <Badge>{this.props.detail.otu_count}</Badge>
                        </NavItem>
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
                    <Route path="/refs/:refId/otus" component={OTUList} />
                    <Route path="/refs/:refId/indexes" component={IndexList} />
                    <Route path="/refs/:refId/settings" render={() => <ReferenceSettings isRemote={remotes_from} />} />
                </Switch>

                <EditReference />
            </div>
        );
    };
}

const mapStateToProps = state => ({
    error: get(state, "errors.GET_REFERENCE_ERROR", null),
    detail: state.references.detail,
    pathname: state.router.location.pathname,
    refDetail: state.references.detail,
    processes: state.processes.documents,
    canModify: checkRefRight(state, "modify")
});

const mapDispatchToProps = dispatch => ({
    onGetReference: refId => {
        dispatch(getReference(refId));
    },

    onEdit: () => {
        dispatch(push({ ...window.location, state: { editReference: true } }));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(ReferenceDetail);
