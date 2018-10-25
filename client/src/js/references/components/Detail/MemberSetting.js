import React from "react";
import { Panel } from "react-bootstrap";
import { capitalize } from "lodash-es";
import { Icon } from "../../../base";
import AdministrationSection from "../../../administration/components/Section";

const MemberSetting = props => {
    const addIcon = <Icon name="plus-square" bsStyle="primary" tip="Add Member" onClick={props.onAdd} />;

    const description = `Edit permissions for, add, or remove individual ${props.noun} that can access this reference.`;

    const content = <Panel.Body>{props.listComponents}</Panel.Body>;

    return (
        <AdministrationSection
            title={capitalize(props.noun)}
            description={description}
            content={content}
            extraIcon={addIcon}
        />
    );
};

export default MemberSetting;
