/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Quality
 */

'use strict';

var React = require('react');
var Panel = require('react-bootstrap/lib/Panel');

var Chart = require('./Chart.jsx');
var Bases = require('./Bases.jsx');
var Nucleotides = require('./Nucleotides.jsx');
var Sequences = require('./Sequences.jsx');

var Icon = require('virtool/js/components/Base/Icon.jsx');
var PushButton = require('virtool/js/components/Base/PushButton.jsx');

/**
 * A component that renders the three quality graphs associated with a sample given sample data.
 *
 * @class
 */
var Quality = React.createClass({

    getInitialState: function () {
        return {
            pending: false,
            download: null
        };
    },

    pdf: function () {
        this.setState({
            pending: true,
            download: null
        }, function () {
            dispatcher.db.samples.request('quality_pdf', {_id: this.props.data._id}).success(function (data) {
                this.setState({
                    pending: false,
                    download: data.file_id
                });
            }, this);
        });
    },

    render: function () {

        var data = this.props.data;
        var active = this.props.activeKey === 2;

        if (active) {

            var buttonProps = {
                onClick: this.state.download ? null : this.pdf,
                bsStyle: this.state.download ? 'primary' : 'default',
                href: this.state.download ? 'download/' + this.state.download : null,
                download: this.state.download ? 'quality_' + this.props.data._id + '.pdf' : null
            };

            return (
                <Panel className="tab-panel">
                    <div ref='container' className='printable-quality'>
                        <h5>
                            <strong>Quality Distribution at Read Positions</strong>
                            <PushButton bsSize='xsmall' {...buttonProps} pullRight>
                                <Icon name='file-pdf' pending={this.state.pending}/> PDF
                            </PushButton>
                        </h5>
                        <Chart
                            createChart={Bases}
                            data={data.quality.bases}
                            active={active}
                        />

                        <h5><strong>Nucleotide Composition at Read Positions</strong></h5>
                        <Chart
                            createChart={Nucleotides}
                            data={data.quality.composition}
                            active={active}
                        />

                        <h5><strong>Read-wise Quality Occurrence</strong></h5>
                        <Chart
                            createChart={Sequences}
                            data={data.quality.sequences}
                            active={active}
                        />

                    </div>
                </Panel>
            );
        } else {
            return <div />;
        }
    }
});

module.exports = Quality;