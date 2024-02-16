import React, { Component } from 'react'
import { CircularProgress, FormControl, InputLabel, MenuItem, Select } from '@mui/material'
import Activity from '../../components/Activity/Activity'
import Card from '../../components/Card/Card'
import { connect } from 'react-redux'
import { getActivities } from '../../actions/activities'
import { ActivityType } from '../../models'

type Props = {
  getActivities: (query?: { limit?: number, skip?: number }) => void
  listData: any
}

type State = {
  selectorValue: string
  scrollReached: boolean
}

class Activities extends Component<Props, State> {
  state: State = {
    selectorValue: 'all',
    scrollReached: false
  }

  componentDidMount() {
    this.props.getActivities({
      skip: 0,
      limit: 25
    });
  }

  filterList = (activity: ActivityType[]) => {
    const { selectorValue } = this.state;
    return activity.filter((atv: ActivityType) => selectorValue === 'all' || atv.details.type === selectorValue);
  }

  onScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const scrollReached = event.currentTarget.scrollHeight - event.currentTarget.scrollTop <= event.currentTarget.clientHeight + 25;
    const limit = Number(this.props.listData?.query?.limit);
    
    if (scrollReached !== this.state.scrollReached && limit < this.props.listData?.total) {
      this.props.getActivities({
        skip: 0,
        limit: limit + 25
      });
      this.setState({ scrollReached });
    }
  }

  render() {
    const { listData } = this.props;

    const filteredList = this.filterList(listData.list);

    return (
      <div className="container mt-4">
        <div className="row" style={{ maxWidth: '1100px', margin: 'auto' }}>
          <div className="col-md-12">
            <Card
              onScroll={this.onScroll}
              bodyStyle={{
                height: '75vh',
                overflow: 'auto',
                marginTop: '20px'
              }}
            >
              <div className='d-flex justify-content-between'>
                <h3> Activities </h3>
                <FormControl sx={{ m: 1, minWidth: 120 }} size="small">
                  <InputLabel id="demo-select-small">Filter</InputLabel>
                  <Select
                    labelId="demo-select-small"
                    id="demo-select-small"
                    label="ALL"
                    defaultValue={this.state.selectorValue}
                    onChange={(event) => this.setState({ selectorValue: event.target.value })}
                  >
                    <MenuItem value="all">
                      <em>ALL</em>
                    </MenuItem>
                    <MenuItem value="order">
                      <em>Only Orders</em>
                    </MenuItem>
                    <MenuItem value="expense">Only Expenses</MenuItem>
                  </Select>
                </FormControl>
              </div>
              <hr style={{ color: '#b7b7b7' }} />
              <div>
                {filteredList && filteredList.map((activity: ActivityType, index: number) => (
                  <Activity 
                    key={activity._id} 
                    activity={activity} 
                    index={index}
                    totalList={listData?.list.length}
                  />
                ))}
              </div>

              {filteredList.length === 0 && !this.props.listData.listStatus.isLoading &&
                <p className='text-center'> No activities found </p>
              }

              {listData.listStatus.isLoading &&
                <div className='text-center'>
                  <CircularProgress />
                </div>
              }
            </Card>
          </div>
        </div>
      </div>
    )
  }
}

const mapStateToProps = (state: any) => {
	return {
		listData: state.activity,
	};
}

const mapDispatchToProps = {
  getActivities,
};

export default connect(mapStateToProps, mapDispatchToProps)(Activities)
