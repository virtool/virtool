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
import { findViruses } from "../../actions";
import VirusList from "./VirusList";

const mapStateToProps = (state) => {
    return {
        documents: state.viruses.documents,
        finding: state.viruses.finding,
        find: state.viruses.find,
        sort: state.viruses.sort,
        descending: state.viruses.descending,
        modified: state.viruses.modified,
        account: state.account
    };
};

const mapDispatchToProps = (dispatch, ownProps) => {
    return {
        onFind: (term) => {
            dispatch(findViruses({find: term || null}));
        },

        onToggleModifiedOnly: () => {
            dispatch(findViruses({modified: !ownProps.modified}));
        }
    };
};

const ManageViruses = withRouter(connect(
    mapStateToProps,
    mapDispatchToProps
)(VirusList));

export default ManageViruses;
