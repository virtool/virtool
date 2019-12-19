import { get } from "lodash-es";
import React from "react";
import styled from "styled-components";

import { device, Icon, Label, ListGroupItem, RelativeTime } from "../../../base";

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

const getMethodIcon = ({ method_name }) => {
    const props = get(methodIconProps, method_name, {
        name: "exclamation-triangle",
        bsStyle: "danger"
    });

    return <Icon {...props} />;
};

const StyledChange = styled(ListGroupItem)`
    display: flex;
    flex-flow: row wrap;
    @media (max-width: ${device.tabelet}) {
        align-items: flex-start;
        display: flex;
        flex-flow: row wrap;
    }
`;

const IconDescriptionNameDate = styled.div`
    align-items: start;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    margin-left: 9px;
    width: 90%;

    @media (max-width: ${device.tabelet}) {
        flex-flow: row wrap;
        flex-direction: column;
    }
`;

const Name = styled.div`
    align-items: center;
    display: flex;
    flex-flow: row wrap;
    margin-right: 10px;
`;

const ChangeIcon = styled.div`
    display: flex;
    margin-right: 4px;
`;

const DateUserId = styled.div`
    @media (max-width: ${device.tabelet}) {
        font-size: 12px;
    }
`;

export class Change extends React.Component {
    handleRevert = () => {
        this.props.revert(this.props.otu.id, this.props.otu.version, this.props._id);
    };

    render() {
        return (
            <StyledChange>
                <Label>{this.props.otu.version}</Label>

                <IconDescriptionNameDate>
                    <Name>
                        <ChangeIcon>{getMethodIcon(this.props)}</ChangeIcon>
                        <span className="test-1">{this.props.description || "No Description"}</span>
                    </Name>
                    <DateUserId>
                        <RelativeTime style={{ fontSize: 12 }} time={this.props.created_at} /> by
                        <span> {this.props.user.id}</span>
                    </DateUserId>
                </IconDescriptionNameDate>
            </StyledChange>
        );
    }
}
