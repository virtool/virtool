import React from "react";
import { connect } from "react-redux";
import { map, filter, forEach, slice, includes, without } from "lodash-es";
import { FormGroup, InputGroup, FormControl } from "react-bootstrap";
import SampleEntry from "./Entry";
import SampleToolbar from "./Toolbar";
import CreateSample from "./Create/Create";
import CreateAnalysis from "../../analyses/components/Create";
import QuickAnalyze from "./QuickAnalyze";
import { LoadingPlaceholder, NoneFound, ScrollList, ViewHeader, Icon, Button } from "../../base";
import { listSamples } from "../actions";
import { analyze } from "../../analyses/actions";
import { listReadyIndexes } from "../../indexes/actions";
import { listHmms } from "../../hmm/actions";

const SummaryToolbar = ({clearAll, summary, showModal}) => (
    <div key="toolbar" className="toolbar">
        <FormGroup>
            <InputGroup>
                <InputGroup.Addon>
                    <Icon name="times fa-fw" onClick={clearAll} tip="Clear All" />
                </InputGroup.Addon>
                <FormControl
                    type="text"
                    value={summary}
                    readOnly
                />
            </InputGroup>
        </FormGroup>

        <Button
            tip="Analyze"
            icon="chart-area fa-fw"
            bsStyle="success"
            onClick={showModal}
        />
    </div>
);

export class SamplesList extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            selected: [],
            lastChecked: null,
            show: false,
            sampleId: ""
        };
    }

    componentDidMount () {
        this.props.onListHMMs();
        this.props.onListReadyIndexes();

        if (!this.props.fetched) {
            this.props.loadNextPage(1);
        }
    }

    onSelect = (id, index, isShiftKey) => {
        let newSelected = [...this.state.selected];
        let selectedSegment;

        if (isShiftKey && this.state.lastChecked !== null && this.state.lastChecked !== index) {

            const startIndex = (index < this.state.lastChecked) ? index : this.state.lastChecked;
            const endIndex = (startIndex === index) ? this.state.lastChecked : index;

            selectedSegment = slice(this.props.documents, startIndex + 1, endIndex + 1);

        } else {
            selectedSegment = [this.props.documents[index]];
        }

        forEach(selectedSegment, entry => {
            if (includes(newSelected, entry.id)) {
                newSelected = without(newSelected, entry.id);
            } else {
                newSelected.push(entry.id);
            }
        });

        this.setState({
            lastChecked: index,
            selected: newSelected
        });
    };

    onClearSelected = () => {
        const newSelected = map(this.state.selected, entry => (
            {...entry, check: false}
        ));
        this.setState({ selected: newSelected });
    };

    handleAnalyses = (sampleId, references, algorithm) => {
        if (sampleId) {
            this.props.onAnalyze(sampleId, references, algorithm);
        } else {
            forEach(filter(this.state.selected, ["check", true]), entry => {
                this.props.onAnalyze(entry.sampleId, references, algorithm);
            });
        }
        this.onClearSelected();
    };

    handleQuickAnalyze = (sampleId) => {
        this.setState({
            show: true,
            sampleId
        });
    };

    rowRenderer = (index) => (
        <SampleEntry
            key={this.props.documents[index].id}
            index={index}
            id={this.props.documents[index].id}
            userId={this.props.documents[index].user.id}
            isChecked={!!includes(this.state.selected, this.props.documents[index].id)}
            onSelect={this.onSelect}
            isHidden={!!this.state.selected.length}
            quickAnalyze={this.handleQuickAnalyze}
            {...this.props.documents[index]}
        />
    );

    render () {

        if (this.props.documents === null || this.props.hmms.documents === null || this.props.indexes === null) {
            return <LoadingPlaceholder />;
        }

        let noSamples;

        if (!this.props.documents.length) {
            noSamples = <NoneFound key="noSample" noun="samples" noListGroup />;
        }

        const multiSelect = filter(this.state.selected, ["check", true]);
        const message = `Selected ${multiSelect.length} ${(multiSelect.length > 1) ? "samples" : "sample"} to analyze`;

        return (
            <div>
                <ViewHeader title="Samples" totalCount={this.props.total_count} />

                {multiSelect.length ? (
                    <SummaryToolbar
                        clearAll={this.onClearSelected}
                        summary={message}
                        showModal={() => this.setState({ show: true })}
                    />
                ) : <SampleToolbar />}

                {noSamples || (
                    <ScrollList
                        hasNextPage={this.props.page < this.props.page_count}
                        isNextPageLoading={this.props.isLoading}
                        isLoadError={this.props.errorLoad}
                        list={this.props.documents}
                        loadNextPage={this.props.loadNextPage}
                        page={this.props.page}
                        rowRenderer={this.rowRenderer}
                    />)}

                <CreateSample />

                <CreateAnalysis
                    id={this.state.sampleId}
                    samples={multiSelect.length ? multiSelect : null}
                    show={this.state.show}
                    onHide={() => this.setState({show: false})}
                    onSubmit={this.handleAnalyses}
                    hasHmm={!!this.props.hmms.status.installed}
                    refIndexes={this.props.indexes}
                />

                <QuickAnalyze />
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    ...state.samples,
    indexes: state.analyses.readyIndexes,
    hmms: state.hmms
});

const mapDispatchToProps = (dispatch) => ({

    loadNextPage: (page) => {
        dispatch(listSamples(page));
    },

    onAnalyze: (sampleId, references, algorithm) => {
        forEach(references, (entry) => {
            dispatch(analyze(sampleId, entry.refId, algorithm));
        });
    },

    onListHMMs: () => {
        dispatch(listHmms());
    },

    onListReadyIndexes: () => {
        dispatch(listReadyIndexes());
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(SamplesList);
