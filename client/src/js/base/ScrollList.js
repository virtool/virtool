import React from "react";
import { InfiniteLoader, List, AutoSizer } from "react-virtualized";
import { noop } from "lodash-es";

export class ScrollList extends React.Component {

    render () {

        const { hasNextPage, isNextPageLoading, loadNextPage, page, list } = this.props;

        const rowCount = hasNextPage ? list.length + 1 : list.length;
        const loadMoreRows = isNextPageLoading ? noop : loadNextPage;

        const isRowLoaded = ({ index }) => {
            return !hasNextPage || index < list.length;
        };

        return (
            <InfiniteLoader
                isRowLoaded={isRowLoaded}
                loadMoreRows={loadMoreRows}
                rowCount={rowCount}
            >
                {({ onRowsRendered, registerChild }) =>
                    <div className="infinite-scroll-list">
                        <AutoSizer>
                            {({ width, height }) => {
                                return (
                                    <List
                                        ref={registerChild}
                                        onRowsRendered={onRowsRendered}
                                        width={width}
                                        height={height}
                                        deferredMeasurementCache={this.props.cache}
                                        rowHeight={this.props.cache.rowHeight}
                                        rowRenderer={this.props.rowRenderer}
                                        rowCount={list.length}
                                        overscanRowCount={3}
                                    />
                                );
                            }}
                        </AutoSizer>
                    </div>
                }
            </InfiniteLoader>
        );
    }
}
