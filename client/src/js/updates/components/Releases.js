import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { pushState } from "../../app/actions";
import { Icon } from "../../base";
import Install from "./Install";
import ReleasesList from "./List";

const StyledReleases = styled.div`
    flex: 1 0 auto;
    margin-right: 15px;
`;

export const Releases = ({ onShowInstall, releases }) => {
    if (releases.length) {
        return (
            <StyledReleases>
                <ReleasesList releases={releases} onShowInstall={onShowInstall} />
                <Install />
            </StyledReleases>
        );
    }

    return (
        <StyledReleases>
            <Icon bsStyle="success" name="check" />
            <strong className="text-success"> Software is up-to-date</strong>
        </StyledReleases>
    );
};

export const mapStateToProps = state => ({
    releases: state.updates.releases
});

export const mapDispatchToProps = dispatch => ({
    onShowInstall: () => {
        dispatch(pushState({ install: true }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(Releases);
