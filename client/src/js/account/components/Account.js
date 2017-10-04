/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */
import React from "react";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { Switch, Redirect, Route } from "react-router-dom";
import { Nav, NavItem } from "react-bootstrap";

import { getAccount } from "../actions";
import AccountGeneral from "./General";


class Account extends React.Component {

    constructor (props) {
        super(props);
    }

    componentWillMount () {
        this.props.onGet();
    }

    render = () => (
        <div className="container">
            <h3 className="view-header">
                <strong>Account</strong>
            </h3>

            <Nav bsStyle="tabs">
                <LinkContainer to="/account/general">
                    <NavItem>General</NavItem>
                </LinkContainer>
            </Nav>

            <Switch>
                <Redirect from="/account" to="/account/general" exact/>
                <Route path="/account/general" component={AccountGeneral}/>
            </Switch>
        </div>
    );
}

const mapStateToProps = (state) => {
    return {
        account: state.account
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onGet: () => {
            dispatch(getAccount());
        }
    }
};

const Container = connect(mapStateToProps, mapDispatchToProps)(Account);

export default Container;
