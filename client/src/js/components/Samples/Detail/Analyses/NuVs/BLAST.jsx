var Numeral = require('numeral');
var React = require('react');
var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Panel = require('react-bootstrap/lib/Panel');
var Alert = require('react-bootstrap/lib/Alert');
var Label = require('react-bootstrap/lib/Label');
var Table = require('react-bootstrap/lib/Table');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var Flex = require('virtool/js/components/Base/Flex.jsx');
var Button = require('virtool/js/components/Base/PushButton.jsx');

var NuVsBLAST = React.createClass({

    blast: function () {
        dispatcher.db.analyses.request("blast_nuvs_sequence", {
            _id: this.props.analysisId,
            sequence_index: this.props.sequenceIndex
        })
    },

    render: function () {

        console.log(this.props);

        if (this.props.blast) {

            if (this.props.blast.ready) {
                var hitComponents = this.props.blast.hits.map(function (hit, index) {

                    var href = "https://www.ncbi.nlm.nih.gov/nuccore/" + hit.accession;

                    return (
                        <tr key={index}>
                            <td><a target="_blank" href={href}>{hit.accession}</a></td>
                            <td>{hit.name}</td>
                            <td>{hit.evalue}</td>
                            <td>{hit.score}</td>
                            <td>{Numeral(hit.identity / hit.align_len).format("0.00")}</td>
                        </tr>
                    )
                });

                return (
                    <Panel header="NCBI BLAST">
                        <Table fill condensed>
                            <thead>
                                <tr>
                                    <th>Accession</th>
                                    <th>Name</th>
                                    <th>E-value</th>
                                    <th>Score</th>
                                    <th>Identity</th>
                                </tr>
                            </thead>
                            <tbody>
                                {hitComponents}
                            </tbody>
                        </Table>
                    </Panel>
                );
            }

            var ridHref = "https://blast.ncbi.nlm.nih.gov/Blast.cgi?CMD=Web&PAGE_TYPE=BlastFormatting&OLD_BLAST=false&GET_RID_INFO=on&RID=";

            ridHref += this.props.blast.rid;

            return (
                <Alert bsStyle="info">
                    <span>BLAST in progress with RID </span>
                    <a target="_blank" href={ridHref}>{this.props.blast.rid} <sup><Icon name="new-tab" /></sup></a>
                </Alert>
            );
        }

        return (
            <Alert bsStyle="info">
                <Flex alignItems="center">
                    <Flex.Item>
                        <Icon name="info" />
                    </Flex.Item>
                    <Flex.Item grow={1} pad={5}>
                        This sequence has no BLAST information attached to it.
                    </Flex.Item>
                    <Flex.Item pad={10}>
                        <Button bsStyle="primary" bsSize="small" onClick={this.blast}>
                            BLAST
                        </Button>
                    </Flex.Item>
                </Flex>
            </Alert>
        )

        return (
            <div className="nuvs-item nuvs-orf">
                <div className="nuvs-item-header">
                    <Flex>
                        <Flex.Item>
                            {_.capitalize(hmm.label)}
                        </Flex.Item>
                        <Flex.Item pad={5}>
                            <small className="text-primary text-strong">
                                {this.props.nuc.length}
                            </small>
                        </Flex.Item>
                        <Flex.Item pad={5}>
                            <small className="text-danger text-strong">
                                {hmm.best_e}
                            </small>
                        </Flex.Item>
                    </Flex>
                </div>

                <div ref='container' />
            </div>
        );
    }
});

module.exports = NuVsBLAST;