import React from "react";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { Button, Icon, SearchInput, Toolbar } from "../../base";
import { checkRefRight } from "../../utils/utils";
import { findOTUs } from "../actions";

export class OTUToolbar extends React.Component {
    find = e => {
        this.props.onFind(this.props.refId, e.target.value, this.props.verified, 1);
    };

    filterVerified = () => {
        this.props.onFind(this.props.refId, this.props.term, !this.props.verified, 1);
    };

    render() {
        const { canModify, term, verified } = this.props;

        let createButton;

        if (canModify) {
            createButton = (
                <LinkContainer to={{ state: { createOTU: true } }} replace>
                    <Button bsStyle="primary" tip="Create">
                        <Icon name="plus-square" />
                    </Button>
                </LinkContainer>
            );
        }

        return (
            <Toolbar>
                <SearchInput placeholder="Name or abbreviation" value={term} onChange={this.find} />

                <Button id="verified-button" tip="Filter Unverified" onClick={this.filterVerified} active={verified}>
                    <Icon name="filter" />
                </Button>

                {createButton}
            </Toolbar>
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

export default connect(mapStateToProps, mapDispatchToProps)(OTUToolbar);
