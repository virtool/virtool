import React from "react";
import { connect } from "react-redux";
import { Icon, ModalAlert } from "../../../base";

export const CreateAPIKeyInfo = ({ administrator }) => {
    if (administrator) {
        return (
            <ModalAlert color="purple">
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
            </ModalAlert>
        );
    }

    return null;
};

export const mapStateToProps = state => ({
    administrator: state.account.administrator
});

export default connect(mapStateToProps)(CreateAPIKeyInfo);
