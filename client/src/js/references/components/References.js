import React from "react";
import { Switch, Route, Redirect } from "react-router-dom";
import { connect } from "react-redux";
import { mapSettingsStateToProps } from "../../administration/mappers";
import { Container, LoadingPlaceholder, NarrowContainer, ViewHeader, ViewHeaderTitle } from "../../base";
import SourceTypes from "./SourceTypes";
import ReferenceList from "./List";
import ReferenceDetail from "./Detail/Detail";
import AddReference from "./Add";

export const ReferenceSettings = () => (
    <NarrowContainer>
        <ViewHeader title="Reference Settings">
            <ViewHeaderTitle>Settings</ViewHeaderTitle>
        </ViewHeader>
        <SourceTypes global />
    </NarrowContainer>
);

export const References = ({ loading }) => {
    if (loading) {
        return <LoadingPlaceholder />;
    }

    return (
        <Container>
            <Switch>
                <Route path="/refs" component={ReferenceList} exact />
                <Redirect from="/refs/settings/*" to="/refs/settings" />
                <Route path="/refs/settings" component={ReferenceSettings} />
                <Route path="/refs/add" component={AddReference} />
                <Route path="/refs/:refId" component={ReferenceDetail} />
            </Switch>
        </Container>
    );
};

export default connect(mapSettingsStateToProps)(References);
