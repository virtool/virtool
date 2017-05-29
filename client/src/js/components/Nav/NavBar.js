/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { connect } from "react-redux";
import { withRouter } from "react-router-dom";
import Bar from "./Bar";

const mapStateToProps = (state) => {
    return state.account;
};

const mapDispatchToProps = () => {
    return {};
};

const NavBar = withRouter(connect(
    mapStateToProps,
    mapDispatchToProps
)(Bar));

export default NavBar;
