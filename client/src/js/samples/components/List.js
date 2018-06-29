import React from "react";
import { connect } from "react-redux";
import { map, filter, forEach } from "lodash-es";
import { FormGroup, InputGroup, FormControl } from "react-bootstrap";
import SampleEntry from "./Entry";
import SampleToolbar from "./Toolbar";
import CreateSample from "./Create/Create";
import CreateAnalysis from "./Analyses/Create";
import QuickAnalyze from "./QuickAnalyze";
import { LoadingPlaceholder, NoneFound, ScrollList, ViewHeader, Icon, Button } from "../../base";
import { fetchSamples, analyze } from "../actions";
import {listReadyIndexes} from "../../indexes/actions";
import { fetchHmms } from "../../hmm/actions";
import { getUpdatedScrollListState } from "../../utils";

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

const createSelection = (list) => (
    map(list, (entry, index) => ({
        sampleId: list[index].id,
        check: false
    }))
);

export class SamplesList extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            masterList: this.props.documents,
            list: this.props.documents,
            page: this.props.page,
            selected: createSelection(this.props.documents),
            lastChecked: null,
            show: false,
            sampleId: ""
        };
    }

    componentDidMount () {
        this.props.onFetchHMMs();
        this.props.onListReadyIndexes();
    }

    static getDerivedStateFromProps (nextProps, prevState) {
        const newState = getUpdatedScrollListState(nextProps, prevState);

        if (newState.masterList
            && newState.masterList.length
            && (!prevState.masterList || !prevState.masterList.length)) {

            const newSelected = createSelection(newState.masterList);

            return {
                ...prevState,
                ...newState,
                selected: newSelected
            };
        }

        return {
            ...prevState,
            ...newState,
            selected: prevState.selected
        };
    }

    onSelect = (index, isShiftKey) => {

        let newSelected = this.state.selected.slice();

        if (isShiftKey && this.state.lastChecked !== null && this.state.lastChecked !== index) {

            const startIndex = (index < this.state.lastChecked) ? index : this.state.lastChecked;
            const endIndex = (startIndex === index) ? this.state.lastChecked : index;

            newSelected = map(newSelected, (entry, i) => {
                if (i < startIndex || i > endIndex) {
                    return entry;
                }
                return newSelected[index].check ? {...entry, check: false} : {...entry, check: true};
            });

        } else {
            newSelected[index].check = !newSelected[index].check;
        }

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
            key={this.state.masterList[index].id}
            index={index}
            id={this.state.masterList[index].id}
            userId={this.state.masterList[index].user.id}
            isChecked={this.state.selected[index] ? this.state.selected[index].check : false}
            onSelect={this.onSelect}
            isHidden={!!filter(this.state.selected, ["check", true]).length}
            quickAnalyze={this.handleQuickAnalyze}
            {...this.state.masterList[index]}
        />
    );

    render () {

        if (this.props.documents === null || this.props.hmms.documents === null || this.props.indexes === null) {
            return <LoadingPlaceholder />;
        }

        let noSamples;

        if (!this.state.masterList.length) {
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

                {noSamples}

                <ScrollList
                    hasNextPage={this.props.page < this.props.page_count}
                    isNextPageLoading={this.props.isLoading}
                    isLoadError={this.props.errorLoad}
                    list={this.state.masterList}
                    loadNextPage={this.onNextPage}
                    page={this.state.page}
                    rowRenderer={this.rowRenderer}
                />

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
    indexes: state.samples.readyIndexes,
    hmms: state.hmms
});

const mapDispatchToProps = (dispatch) => ({

    onNextPage: (page) => {
        dispatch(fetchSamples(page));
    },

    onAnalyze: (sampleId, references, algorithm) => {
        forEach(references, (entry) => {
            dispatch(analyze(sampleId, entry.refId, algorithm));
        });
    },

    onFetchHMMs: () => {
        dispatch(fetchHmms());
    },

    onListReadyIndexes: () => {
        dispatch(listReadyIndexes());
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(SamplesList);
