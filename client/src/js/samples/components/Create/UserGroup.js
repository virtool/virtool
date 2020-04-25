import { map } from "lodash-es";
import React from "react";
import styled from "styled-components";
import { InputGroup, InputLabel, Select } from "../../../base";

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
        <InputGroup>
            <InputLabel>User Group</InputLabel>
            <Select value={group} onChange={onChange}>
                <option key="none" value="none">
                    None
                </option>
                {groupComponents}
            </Select>
        </InputGroup>
    );
};
