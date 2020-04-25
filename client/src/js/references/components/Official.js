import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { Box, Button, ExternalLink } from "../../base";
import { checkAdminOrPermission } from "../../utils/utils";
import { remoteReference } from "../actions";

const StyledReferenceOfficial = styled(Box)`
    align-items: center;
    display: flex;

    h5 {
        font-size: 16px;
        font-weight: bold;
    }

    button {
        margin-left: auto;
    }
`;

export const ReferenceOfficial = ({ show, onRemote }) => {
    if (show) {
        return (
            <StyledReferenceOfficial>
                <div>
                    <h5>Official Reference</h5>
                    <p>
                        <span>We have published an official </span>
                        <ExternalLink href="https://github.com/virtool/ref-plant-viruses">
                            plant virus reference
                        </ExternalLink>
                        <span> for install. Once installed, it can be kept automatically up-to-date.</span>
                    </p>
                </div>
                <Button color="blue" icon="cloud-download-alt" onClick={onRemote}>
                    Install
                </Button>
            </StyledReferenceOfficial>
        );
    }

    return null;
};

const mapStateToProps = state => ({
    show: !state.references.official_installed && checkAdminOrPermission(state, "create_ref")
});

const mapDispatchToProps = dispatch => ({
    onRemote: () => {
        dispatch(remoteReference());
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(ReferenceOfficial);
