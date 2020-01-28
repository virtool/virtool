import { push } from "connected-react-router";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { Icon, Box } from "../../base";
import Install from "./Install";
import ReleasesList from "./List";

const StyledReleasesPanelBody = styled(Box)`
    padding: 10px 15px;
`;

export const Releases = ({ onShowInstall, releases }) => {
    if (releases.length) {
        return (
            <StyledReleasesPanelBody>
                <ReleasesList releases={releases} onShowInstall={onShowInstall} />
                <Install />
            </StyledReleasesPanelBody>
        );
    }

    return (
        <StyledReleasesPanelBody>
            <Icon bsStyle="success" name="check" />
            <strong className="text-success"> Software is up-to-date</strong>
        </StyledReleasesPanelBody>
    );
};

export const mapStateToProps = state => ({
    releases: state.updates.releases
});

export const mapDispatchToProps = dispatch => ({
    onShowInstall: () => {
        dispatch(push({ state: { install: true } }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(Releases);
