import { get } from "lodash-es";
import React, { useCallback } from "react";
import styled from "styled-components";

import { Attribution, BoxGroupSection, Icon, Label } from "../../../base";

const methodIconProps = {
    add_isolate: {
        name: "flask",
        color: "blue"
    },
    create: {
        name: "plus-square",
        color: "blue"
    },
    create_sequence: {
        name: "dna",
        color: "blue"
    },
    edit: {
        name: "pencil-alt",
        color: "orange"
    },
    edit_isolate: {
        name: "flask",
        color: "orange"
    },
    edit_sequence: {
        name: "dna",
        color: "orange"
    },
    clone: {
        name: "clone",
        color: "blue"
    },
    import: {
        name: "file-import",
        color: "blue"
    },
    remote: {
        name: "link",
        color: "blue"
    },
    remove: {
        name: "trash",
        color: "red"
    },
    remove_isolate: {
        name: "flask",
        color: "red"
    },
    remove_sequence: {
        name: "dna",
        color: "red"
    },
    set_as_default: {
        name: "star",
        color: "orange"
    },
    update: {
        name: "arrow-alt-circle-up",
        color: "orange"
    }
};

const getMethodIcon = methodName => {
    const props = get(methodIconProps, methodName, {
        name: "exclamation-triangle",
        color: "red"
    });

    return <Icon {...props} />;
};

const StyledChange = styled(BoxGroupSection)`
    align-items: center;
    display: grid;
    grid-template-columns: 42px 2fr 1fr 15px;

    div:first-child {
        min-width: 42px;
    }
`;

const Description = styled.div`
    align-items: center;
    display: flex;

    i {
        margin-right: 5px;
    }
`;

export const Change = ({ id, createdAt, description, methodName, otu, unbuilt, user, onRevert }) => {
    const handleRevert = useCallback(() => {
        onRevert(otu.id, otu.version, id);
    }, [otu.id, otu.version, id]);

    return (
        <StyledChange>
            <div>
                <Label>{otu.version}</Label>
            </div>

            <Description>
                {getMethodIcon(methodName)}
                <span>{description || "No Description"}</span>
            </Description>

            <Attribution time={createdAt} user={user.id} verb="" />

            {unbuilt && <Icon name="history" tip="Revert" onClick={handleRevert} />}
        </StyledChange>
    );
};
