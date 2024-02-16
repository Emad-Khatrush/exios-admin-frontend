import React, { Component } from 'react';
import ArrowPercent from '../ArrowPercent/ArrowPercent';
import Card from '../Card/Card';

import { FaLongArrowAltRight } from "react-icons/fa";
import { Doughnut } from 'react-chartjs-2';
import {Chart, ArcElement, Tooltip } from 'chart.js'
import { Link } from 'react-router-dom';
import { HomeData } from '../../models';

import './EarningWidget.scss';

type Props = {
  earingData: HomeData
};

type State = {
  displayType: string
};

Chart.register([ArcElement, Tooltip]);

class EarningWidget extends Component<Props, State> {

  state = {
    displayType: 'Monthly'
  }

  render() {
    const { displayType } = this.state;
    const { earingData: { monthlyEarning, betterThenPreviousMonth, percentage, totalMonthlyEarning } } = this.props;

    let labels: string[] = [];
    let values: number[] = [];
    monthlyEarning.forEach(data => {
      labels.push(data.type);
      values.push(data.total);
    });

    const data = {
      labels,
      dataLabels: {
        enabled: false
     },
      datasets: [{
        label: 'My First Dataset',
        data: values,
        backgroundColor: [
          'rgb(255, 99, 132)',
          'rgb(54, 162, 235)',
          'rgb(255, 205, 86)'
        ],
        hoverOffset: 4
      }]
    };

  const options: any = {
    plugins: {
      legend: {
        display: true,
        position: "bottom",
      },
      tooltip: {
        callbacks: {
          label: (data: any) => `${data.label} $${data.formattedValue}`
        }
      },
      
    }
}

    return(
      <Card>
        <div className='row align-items-center'>
          <div className='col-md-12 col-lg-7'>
            <p className='title'> {displayType} Earning</p>
            <p className='this-date mb-0'> This month </p>
            <p className='cash mb-1'> ${totalMonthlyEarning.toFixed(2)} </p>
            <div className='d-flex align-items-center'>
              <ArrowPercent percent={percentage} positive={betterThenPreviousMonth} />
              <p className='result'> From previous period </p>
            </div>
            <Link to={'/invoices'}> <button className="view-more"> View More <FaLongArrowAltRight className='ml-5'/> </button> </Link>
          </div>

          <div className="col-md-12 col-lg-5 mt-3">
            <div className='d-flex justify-content-center'>
              <Doughnut
                options={options}
                data={data}
              />
            </div>
          </div>
        </div>
      </Card>
    );
  }
}

export default EarningWidget;
