import { get } from "lodash-es";
import React, { useCallback } from "react";
import styled from "styled-components";

import { Attribution, BoxGroupSection, Icon, Label } from "../../../base";

const methodIconProps = {
    add_isolate: {
        name: "flask",
        color: "primary"
    },
    create: {
        name: "plus-square",
        color: "primary"
    },
    create_sequence: {
        name: "dna",
        color: "primary"
    },
    edit: {
        name: "pencil-alt",
        color: "orangeDarkest"
    },
    edit_isolate: {
        name: "flask",
        color: "orangeDarkest"
    },
    edit_sequence: {
        name: "dna",
        color: "orangeDarkest"
    },
    clone: {
        name: "clone",
        color: "primary"
    },
    import: {
        name: "file-import",
        color: "primary"
    },
    remote: {
        name: "link",
        color: "primary"
    },
    remove: {
        name: "trash",
        color: "redDark"
    },
    remove_isolate: {
        name: "flask",
        color: "redDark"
    },
    remove_sequence: {
        name: "dna",
        color: "redDark"
    },
    set_as_default: {
        name: "star",
        color: "orangeDarkest"
    },
    update: {
        name: "arrow-alt-circle-up",
        color: "orangeDarkest"
    }
};

const getMethodIcon = methodName => {
    const props = get(methodIconProps, methodName, {
        name: "exclamation-triangle",
        color: "redDark"
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

export const Change = ({ id, createdAt, description, methodName, otu, user, onRevert }) => {
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

            <Icon name="history" tip="Revert" onClick={handleRevert} />
        </StyledChange>
    );
};
