/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { connect } from "react-redux";
import Main from "../Main";

const mapStateToProps = (state) => state.account;

const MainContainer = connect(mapStateToProps)(Main);

export default MainContainer;
