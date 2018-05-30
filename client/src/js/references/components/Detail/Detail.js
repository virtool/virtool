import React from "react";
import Moment from "moment";
import { connect } from "react-redux";
import { Switch, Route, Redirect } from "react-router-dom";
import { push } from "react-router-redux";
import { LinkContainer } from "react-router-bootstrap";
import { Nav, NavItem, Badge } from "react-bootstrap";
import { getReference } from "../../actions";
import { LoadingPlaceholder, Icon, ViewHeader, Flex, FlexItem } from "../../../base";

import EditReference from "./Edit";
import ReferenceManage from "./Manage";
import ReferenceOTUs from "../../../otus/components/List";
import ReferenceIndexList from "../../../indexes/components/List";
import SourceTypes from "../../../administration/components/General/SourceTypes";
import InternalControl from "../../../administration/components/General/InternalControl";

const ReferenceSettings = () => (
    <div className="settings-container">
        <SourceTypes />
        <InternalControl />
    </div>
);

class ReferenceDetail extends React.Component {

    componentDidMount () {
        this.props.onGetReference(this.props.match.params.refId);
    }

    render = () => {

        if (this.props.detail === null || this.props.detail.id !== this.props.match.params.refId) {
            return <LoadingPlaceholder />;
        }

        const { name, id, remotes_from, created_at, user } = this.props.detail;

        let headerIcon;

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
                : (
                    <Icon
                        bsStyle="warning"
                        name="pencil-alt"
                        tip="Edit"
                        onClick={this.props.onEdit}
                        pullRight
                        style={{fontSize: "65%"}}
                    />
                );
        }

        return (
            <div>
                <ViewHeader title={`${name} - References`}>
                    <Flex alignItems="flex-end">
                        <FlexItem grow={1}>
                            <strong>{name}</strong>
                        </FlexItem>
                        {headerIcon}
                    </Flex>
                    <div className="text-muted" style={{fontSize: "12px"}}>
                        Created {Moment(created_at).calendar()} by {user.id}
                    </div>
                </ViewHeader>

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
                    <Route path="/refs/:refId/settings" component={ReferenceSettings} />
                </Switch>

                <EditReference />
            </div>
        );
    };
}

const mapStateToProps = state => ({
    detail: state.references.detail,
    pathname: state.router.location.pathname
});

const mapDispatchToProps = dispatch => ({

    onGetReference: (refId) => {
        dispatch(getReference(refId));
    },

    onEdit: () => {
        dispatch(push({...window.location, state: {editReference: true}}));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(ReferenceDetail);
