import { connect } from "react-redux";
import { includes, map, xor } from "lodash-es";
import React from "react";
import { Checkbox, Flex, FlexItem } from "../../base";
import { findSamples } from "../actions";
import { SampleEntryLabel } from "./Item";

const statuses = [true, "ip", false];

const AlgorithmStatus = ({ algorithm, checked, onClick, status }) => (
    <div onClick={() => onClick(algorithm, status)}>
        <Flex alignItems="center" style={{ cursor: "pointer", padding: "3px" }}>
            <Checkbox checked={checked} />
            <FlexItem pad={5}>
                <SampleEntryLabel icon="chart-area" label={algorithm} ready={status} />
            </FlexItem>
        </Flex>
    </div>
);

class AlgorithmFilter extends React.Component {
    handleClick = (algorithm, status) => {
        const { term, pathoscope, nuvs, onFind } = this.props;

        if (algorithm === "Pathoscope") {
            onFind(term, xor(pathoscope, [status]), nuvs);
        } else {
            onFind(term, pathoscope, xor(nuvs, [status]));
        }
    };

    render() {
        const { pathoscope, nuvs } = this.props;

        const nuvsComponents = map(statuses, status => (
            <AlgorithmStatus
                key={status}
                algorithm="NuVs"
                checked={includes(nuvs, status)}
                onClick={this.handleClick}
                status={status}
            />
        ));

        const pathoscopeComponents = map(statuses, status => (
            <AlgorithmStatus
                key={status}
                algorithm="Pathoscope"
                checked={includes(pathoscope, status)}
                onClick={this.handleClick}
                status={status}
            />
        ));

        return (
            <div>
                <strong>Analysis State</strong>
                <Flex style={{ marginTop: "7px" }}>
                    <FlexItem>{pathoscopeComponents}</FlexItem>
                    <FlexItem pad={10}>{nuvsComponents}</FlexItem>
                </Flex>
            </div>
        );
    }
}

const mapStateToProps = state => ({
    term: state.samples.term,
    pathoscope: state.samples.pathoscopeCondition,
    nuvs: state.samples.nuvsCondition
});

const mapDispatchToProps = dispatch => ({
    onFind: (term, pathoscope, nuvs) => {
        dispatch(findSamples(term, 1, pathoscope, nuvs));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(AlgorithmFilter);
