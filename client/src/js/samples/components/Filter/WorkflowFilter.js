import { xor } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { fontWeight, getFontSize } from "../../../app/theme";
import { Box, Button } from "../../../base";
import { getTaskDisplayName } from "../../../utils/utils";
import { findSamples } from "../../actions";
import { getTermFromURL } from "../../selectors";

const statuses = [true, "ip", false];

const WorkflowFilterLabel = styled.div`
    background-color: ${props => props.theme.color.purple};
    color: ${props => props.theme.color.white};
    font-weight: ${fontWeight.thick};
    padding: 4px 8px;
`;

const WorkflowFilterControlButtons = styled.div`
    display: flex;
`;

const StyledWorkflowFilterControl = styled(Box)`
    padding: 0;

    button {
        border-bottom: none;
        border-radius: 0;
        border-left: none;
        flex: 1 0 auto;
        font-size: ${getFontSize("sm")};
        padding: 5px;

        :last-child {
            border-right: none;
        }
    }
`;

const WorkflowFilterControl = ({ workflow, states }) => (
    <StyledWorkflowFilterControl>
        <WorkflowFilterLabel>{getTaskDisplayName(workflow)}</WorkflowFilterLabel>
        <WorkflowFilterControlButtons>
            <Button active={true}>All</Button>
            <Button>None</Button>
            <Button>Pending</Button>
            <Button>Ready</Button>
        </WorkflowFilterControlButtons>
    </StyledWorkflowFilterControl>
);

class WorkflowFilter extends React.Component {
    handleClick = (workflow, status) => {
        const { pathoscope, nuvs, onFind } = this.props;

        if (workflow === "Pathoscope") {
            onFind(xor(pathoscope, [status]), nuvs);
        } else {
            onFind(pathoscope, xor(nuvs, [status]));
        }
    };

    render() {
        const { pathoscope, nuvs } = this.props;

        return (
            <React.Fragment>
                <WorkflowFilterControl workflow="pathoscope" />
                <WorkflowFilterControl workflow="nuvs" />
            </React.Fragment>
        );
    }
}

const mapStateToProps = state => ({
    pathoscope: state.samples.pathoscopeCondition,
    nuvs: state.samples.nuvsCondition
});

const mapDispatchToProps = dispatch => ({
    onFind: (pathoscope, nuvs) => {
        dispatch(findSamples({ pathoscope, nuvs, page: 1 }));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(WorkflowFilter);
