import { push } from "connected-react-router";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { Icon, Panel } from "../../base";
import Install from "./Install";
import ReleasesList from "./List";

const StyledReleasesPanelBody = styled(Panel.Body)`
    padding: 10px 15px;
`;

export const Releases = ({ onShowInstall, releases }) => {
    if (releases.length) {
        return (
            <Panel>
                <StyledReleasesPanelBody>
                    <ReleasesList releases={releases} onShowInstall={onShowInstall} />
                    <Install />
                </StyledReleasesPanelBody>
            </Panel>
        );
    }

    return (
        <Panel>
            <StyledReleasesPanelBody>
                <Icon bsStyle="success" name="check" />
                <strong className="text-success"> Software is up-to-date</strong>
            </StyledReleasesPanelBody>
        </Panel>
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
