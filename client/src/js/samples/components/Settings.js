import React from "react";
import { connect } from "react-redux";
import SampleRights from "../../administration/components/SampleRights";
import UniqueNames from "../../administration/components/UniqueNames";
import { mapSettingsStateToProps } from "../../administration/mappers";
import { LoadingPlaceholder, NarrowContainer, ViewHeader, ViewHeaderTitle } from "../../base";

export const SamplesSettings = ({ loading }) => {
    if (loading) {
        return <LoadingPlaceholder />;
    }

    return (
        <NarrowContainer>
            <ViewHeader title="Sample Settings">
                <ViewHeaderTitle>Sample Settings</ViewHeaderTitle>
            </ViewHeader>
            <UniqueNames />
            <SampleRights />
        </NarrowContainer>
    );
};

export default connect(mapSettingsStateToProps)(SamplesSettings);
