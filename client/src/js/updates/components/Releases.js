import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { pushState } from "../../app/actions";
import { getFontSize, getFontWeight } from "../../app/theme";
import { BoxGroup, BoxGroupSection, Icon } from "../../base";
import Install from "./Install";
import ReleasesList from "./List";

const StyledReleases = styled(BoxGroup)`
    flex: 1 0 auto;
    margin-right: 15px;

    ${BoxGroupSection}:first-child {
        color: ${props => props.theme.color.greenDark};

        strong {
            font-size: ${getFontSize("lg")};
            font-weight: ${getFontWeight("thick")};
        }
    }
`;

export const Releases = ({ onShowInstall, releases }) => {
    if (releases.length) {
        return (
            <React.Fragment>
                <StyledReleases>
                    <ReleasesList releases={releases} onShowInstall={onShowInstall} />
                </StyledReleases>
                <Install />
            </React.Fragment>
        );
    }

    return (
        <StyledReleases>
            <BoxGroupSection>
                <Icon name="check" />
                <strong> Software is up-to-date</strong>
            </BoxGroupSection>
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
