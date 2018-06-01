import React from "react";
import { InfiniteLoader, List, AutoSizer } from "react-virtualized";

const getNextPage = (page) => {
    return page + 1;
};

export class ScrollList extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            masterList: props.list.slice(),
            list: props.list
        };

        this.props.loadNextPage(1);
    }

    static getDerivedStateFromProps (nextProps, prevState) {

        if (prevState.list !== nextProps.list) {
            return {
                masterList: prevState.masterList.concat(nextProps.list),
                list: nextProps.list
            };
        }

        return null;
    }

    render () {

        const { hasNextPage, isNextPageLoading, loadNextPage, page } = this.props;

        console.log("hasNextPage: ", hasNextPage, ", isNextPageLoading: ", isNextPageLoading, ", page: ", page);
        console.log("list: ", this.state.list);
    
        const rowCount = hasNextPage ? this.state.list.length + 1 : this.state.list.length;
        const loadMoreRows = (isNextPageLoading || !hasNextPage) ? () => {} : loadNextPage;

        const isRowLoaded = ({ index }) => {
            console.log(index, this.state.masterList.length);
            return !hasNextPage || index < this.state.list.length;
        }
    
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
                                console.log("width: ", width, ", height: ", height);
                                return (
                                    <List
                                        ref={registerChild}
                                        onRowsRendered={onRowsRendered}
                                        width={width}
                                        height={height}
                                        deferredMeasurementCache={this.props.cache}
                                        rowHeight={this.props.cache.rowHeight}
                                        rowRenderer={this.props.rowRenderer}
                                        rowCount={this.state.list.length}
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
