import { get } from "lodash-es";
import React, { useCallback } from "react";
import styled from "styled-components";

import { Attribution, BoxGroupSection, Icon, Label } from "../../../base";

const methodIconProps = {
    add_isolate: {
        name: "flask",
        bsStyle: "primary"
    },
    create: {
        name: "plus-square",
        bsStyle: "primary"
    },
    create_sequence: {
        name: "dna",
        bsStyle: "primary"
    },
    edit: {
        name: "pencil-alt",
        bsStyle: "warning"
    },
    edit_isolate: {
        name: "flask",
        bsStyle: "warning"
    },
    edit_sequence: {
        name: "dna",
        bsStyle: "warning"
    },
    clone: {
        name: "clone",
        bsStyle: "primary"
    },
    import: {
        name: "file-import",
        bsStyle: "primary"
    },
    remote: {
        name: "link",
        bsStyle: "primary"
    },
    remove: {
        name: "trash",
        bsStyle: "danger"
    },
    remove_isolate: {
        name: "flask",
        bsStyle: "danger"
    },
    remove_sequence: {
        name: "dna",
        bsStyle: "danger"
    },
    set_as_default: {
        name: "star",
        bsStyle: "warning"
    },
    update: {
        name: "arrow-alt-circle-up",
        bsStyle: "warning"
    }
};

const getMethodIcon = methodName => {
    const props = get(methodIconProps, methodName, {
        name: "exclamation-triangle",
        bsStyle: "danger"
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
                <span className="test-1">{description || "No Description"}</span>
            </Description>

            <Attribution time={createdAt} user={user.id} verb="" />

            <Icon name="history" tip="Revert" onClick={handleRevert} />
        </StyledChange>
    );
};
