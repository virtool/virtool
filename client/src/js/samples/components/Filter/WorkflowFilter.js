import { xor } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { getBorder, getFontSize } from "../../../app/theme";
import { Box, Icon, SidebarHeader, SideBarSection } from "../../../base";
import { getWorkflowDisplayName } from "../../../utils/utils";
import { updateSearch } from "../../actions";
import { getWorkflowsFromURL } from "../../selectors";
import { workflowStates } from "../../utils";

const WorkflowFilterLabel = styled.div`
    padding: 4px 8px;
`;

const StyledWorkflowFilterControlButton = styled.button`
    align-items: center;
    background-color: ${props => props.theme.color[props.active ? "purple" : "purpleLightest"]};
    color: ${props => props.theme.color[props.active ? "white" : "purpleDark"]};

    border: 2px solid ${props => props.theme.color.purple};
    border-radius: 20px;
    cursor: pointer;
    justify-content: center;
    display: flex;
    height: 30px;
    transform: scale(${props => (props.active ? 1 : 0.95)});
    width: 30px;

    i {
        font-size: ${getFontSize("md")};
    }

    &[aria-pressed="false"]:hover,
    &[aria-pressed="false"]:focus {
        background-color: ${props => props.theme.color.purpleLight};
        color: ${props => props.theme.color.purpleDarkest};
        outline: none;
    }
`;

const WorkflowFilterControlButton = ({ active, icon, value, onClick }) => (
    <StyledWorkflowFilterControlButton aria-pressed={active} active={active} onClick={() => onClick(value)}>
        <Icon name={icon} />
    </StyledWorkflowFilterControlButton>
);

const WorkflowFilterControlPath = styled.div`
    border: ${getBorder};
    flex: 1 0 auto;
    height: 2px;
`;

const WorkflowFilterControlButtons = styled.div`
    align-items: center;
    display: flex;
    justify-content: stretch;
    padding: 4px 8px 8px;
`;

const StyledWorkflowFilterControl = styled(Box)`
    background: ${props => props.theme.color.white};
    padding: 0;
`;

const WorkflowFilterControl = ({ workflow, states, onChange }) => {
    const handleClick = state => onChange(workflow, state);

    return (
        <StyledWorkflowFilterControl>
            <WorkflowFilterLabel>{getWorkflowDisplayName(workflow)}</WorkflowFilterLabel>
            <WorkflowFilterControlButtons>
                <WorkflowFilterControlButton
                    active={states.includes(workflowStates.NONE)}
                    icon="times"
                    value={workflowStates.NONE}
                    onClick={handleClick}
                />
                <WorkflowFilterControlPath />
                <WorkflowFilterControlButton
                    active={states.includes(workflowStates.PENDING)}
                    icon="running"
                    value={workflowStates.PENDING}
                    onClick={handleClick}
                />
                <WorkflowFilterControlPath />
                <WorkflowFilterControlButton
                    active={states.includes(workflowStates.READY)}
                    icon="check"
                    value={workflowStates.READY}
                    onClick={handleClick}
                />
            </WorkflowFilterControlButtons>
        </StyledWorkflowFilterControl>
    );
};

const WorkflowFilter = ({ workflows, onUpdate }) => {
    const handleClick = (workflow, state) => {
        onUpdate({
            [workflow]: xor(workflows[workflow], [state])
        });
    };

    const { aodp, nuvs, pathoscope } = workflows;

    return (
        <SideBarSection>
            <SidebarHeader>Workflows</SidebarHeader>
            <WorkflowFilterControl workflow="pathoscope" states={pathoscope} onChange={handleClick} />
            <WorkflowFilterControl workflow="nuvs" states={nuvs} onChange={handleClick} />
            <WorkflowFilterControl workflow="aodp" states={aodp} onChange={handleClick} />
        </SideBarSection>
    );
};

export const mapStateToProps = state => ({
    workflows: getWorkflowsFromURL(state)
});

export const mapDispatchToProps = dispatch => ({
    onUpdate: update => {
        dispatch(updateSearch({ workflows: update, page: 1 }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(WorkflowFilter);
