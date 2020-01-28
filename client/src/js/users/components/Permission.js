import React from "react";
import { Icon, SuccessBoxGroupSection, DangerBoxGroupSection } from "../../base";

export const PermissionItem = ({ permission, value }) => {
    if (value) {
        return (
            <SuccessBoxGroupSection>
                <code>{permission}</code> <Icon name={value ? "check" : "times"} pullRight />
            </SuccessBoxGroupSection>
        );
    }
    return (
        <DangerBoxGroupSection>
            <code>{permission}</code> <Icon name={value ? "check" : "times"} pullRight />
        </DangerBoxGroupSection>
    );
};
