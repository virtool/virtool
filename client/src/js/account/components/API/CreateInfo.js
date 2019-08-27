import React from "react";
import styled from "styled-components";
import { connect } from "react-redux";
import { Alert, Icon } from "../../../base";

const StyledCreateAPIKeyInfo = styled(Alert)`
    display: flex;
    margin-bottom: 5px;

    i {
        line-height: 20px;
    }

    p {
        margin-left: 5px;
    }
`;

export const CreateAPIKeyInfo = ({ administrator }) => {
    if (administrator) {
        return (
            <StyledCreateAPIKeyInfo>
                <Icon name="user-shield" />
                <div>
                    <p>
                        <strong>You are an administrator and can create API keys with any permissions you want.</strong>
                    </p>
                    <p>
                        If you lose your administrator role, this API key will revert to your new limited set of
                        permissions.
                    </p>
                </div>
            </StyledCreateAPIKeyInfo>
        );
    }

    return null;
};

export const mapStateToProps = state => ({
    administrator: state.account.administrator
});

export default connect(mapStateToProps)(CreateAPIKeyInfo);
