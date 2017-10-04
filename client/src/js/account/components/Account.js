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
import { Row, Col, Panel } from "react-bootstrap";

import { getAccount } from "../actions";


class Account extends React.Component {

    constructor (props) {
        super(props);
    }

    componentWillMount () {
        this.props.onGet();
    }

    render () {
        return (
            <div className="container">
                <h3 className="view-header">
                    <strong>Account</strong>  <small>{this.props.account.id}</small>
                </h3>


            </div>
        );
    }
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
