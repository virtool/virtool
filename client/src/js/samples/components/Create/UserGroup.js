import React from "react";
import styled from "styled-components";
import { map } from "lodash-es";
import { Col } from "react-bootstrap";
import { InputError } from "../../../base";

const SampleUserGroupItem = styled.option`
    text-transform: capitalize;
`;

export const SampleUserGroup = ({ group, groups, onChange }) => {
    const groupComponents = map(groups, groupId => (
        <SampleUserGroupItem key={groupId} value={groupId}>
            {groupId}
        </SampleUserGroupItem>
    ));

    return (
        <Col md={3}>
            <InputError type="select" label="User Group" value={group} onChange={onChange}>
                <option key="none" value="none">
                    None
                </option>
                {groupComponents}
            </InputError>
        </Col>
    );
};
