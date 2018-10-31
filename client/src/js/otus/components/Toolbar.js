import React from "react";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { Icon, Button } from "../../base";
import { checkRefRight } from "../../utils";
import { findOTUs } from "../actions";

export class OTUToolbar extends React.Component {
    handleFind = e => {
        this.props.onFind(this.props.refId, e.target.value, this.props.verified, 1);
    };

    handleVerified = () => {
        this.props.onFind(this.props.refId, this.props.term, !this.props.verified, 1);
    };

    render() {
        const { canModify, term, verified } = this.props;

        let createButton;

        if (canModify) {
            createButton = (
                <LinkContainer to={{state: { createOTU: true } }} replace>
                    <Button bsStyle="primary" tip="Create">
                        <Icon name="plus-square" />
                    </Button>
                </LinkContainer>
            );
        }

        return (
            <div className="toolbar">
                <div className="form-group">
                    <div className="input-group">
                        <span id="find-addon" className="input-group-addon">
                            <Icon name="search" />
                        </span>
                        <input
                            aria-describedby="find-addon"
                            className="form-control"
                            type="text"
                            placeholder="Name or abbreviation"
                            value={term}
                            onChange={this.handleFind}
                        />
                    </div>
                </div>

                <Button tip="Filter Unverified" onClick={this.handleVerified} active={verified}>
                    <Icon name="filter" />
                </Button>

                {createButton}
            </div>
        );
    }
}

const mapStateToProps = state => {
    const { page, term, verified } = state.otus;
    return {
        canModify: !state.references.detail.remotes_from && checkRefRight(state, "modify_otu"),
        refId: state.references.detail.id,
        page,
        term,
        verified
    };
};

const mapDispatchToProps = dispatch => ({
    onFind: (refId, term, verified) => {
        dispatch(findOTUs(refId, term, verified, 1));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(OTUToolbar);
