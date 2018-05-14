import React from "react";
import { connect } from "react-redux";
import Helmet from "react-helmet";
import { Switch, Route, Redirect } from "react-router-dom";
import { push } from "react-router-redux";
import { LinkContainer } from "react-router-bootstrap";
import { Nav, NavItem } from "react-bootstrap";
import { getReference } from "../../actions";
import { LoadingPlaceholder, Icon } from "../../../base";

import EditReference from "./Edit";
import ReferenceManage from "./Manage";
import ReferenceOTUList from "../../../otus/components/List";
import ReferenceSettings from "./Settings";
import ReferenceIndex from "../../../indexes/components/Indexes";

class ReferenceDetail extends React.Component {

    componentDidMount () {
        this.props.onGetReference(this.props.match.params.refId);
    }

    render = () => {

        if (this.props.detail === null || this.props.detail.id !== this.props.match.params.refId) {
            return <LoadingPlaceholder />;
        }

        const { name, id } = this.props.detail;

        return (
            <div>
                <Helmet>
                    <title>{`${name} - References`}</title>
                </Helmet>
                <h3 className="view-header">
                    <strong>{name}</strong>
                    <Icon
                        bsStyle="warning"
                        name="pencil-alt"
                        onClick={this.props.onEdit}
                        pullRight
                    />
                </h3>
                <Nav bsStyle="tabs">
                    <LinkContainer to={`/refs/${id}/manage`}>
                        <NavItem>Manage</NavItem>
                    </LinkContainer>
                    <LinkContainer to={`/refs/${id}/otus`}>
                        <NavItem>OTU</NavItem>
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
                    <Route path="/refs/:refId/otus" component={ReferenceOTUList} />
                    <Route path="/refs/:refId/indexes" component={ReferenceIndex} />
                    <Route path="/refs/:refId/settings" component={ReferenceSettings} />
                </Switch>

                <EditReference />
            </div>
        );
    };
}

const mapStateToProps = state => ({
    detail: state.references.detail
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
