/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import React, { PropTypes } from "react";
import { connect } from "react-redux";
import { Switch, Redirect, Route } from "react-router-dom";
import { LinkContainer } from "react-router-bootstrap";
import { Badge, Nav, NavItem } from "react-bootstrap";
import IndexGeneral from "./General";
import IndexChanges from "./Changes";

import { getIndex } from "../actions";

class IndexDetail extends React.Component {

    componentWillMount () {
        this.props.onGet(this.props.match.params.indexVersion);
    }

    static propTypes = {
        match: PropTypes.object,
        detail: PropTypes.object,
        onGet: PropTypes.func
    };

    render () {

        if (this.props.detail === null) {
            return <div />;
        }

        const indexVersion = this.props.match.params.indexVersion;

        return (
            <div>
                <h3 className="view-header">
                    <strong>Virus Index {indexVersion}</strong>
                </h3>

                <Nav bsStyle="tabs">
                    <LinkContainer to={`/viruses/indexes/${indexVersion}/general`}>
                        <NavItem>General</NavItem>
                    </LinkContainer>
                    <LinkContainer to={`/viruses/indexes/${indexVersion}/changes`}>
                        <NavItem>Changes  <Badge>{this.props.detail.change_count}</Badge></NavItem>
                    </LinkContainer>
                </Nav>

                <Switch>
                    <Redirect
                        from="/viruses/indexes/:indexVersion"
                        to={`/viruses/indexes/${indexVersion}/general`}
                        exact
                    />
                    <Route path="/viruses/indexes/:indexVersion/general" component={IndexGeneral} />
                    <Route path="/viruses/indexes/:indexVersion/changes" component={IndexChanges} />
                </Switch>
            </div>
        );
    }

}

const mapStateToProps = (state) => {
    return {
        detail: state.indexes.detail
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onGet: (indexVersion) => {
            dispatch(getIndex(indexVersion));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(IndexDetail);

export default Container;
