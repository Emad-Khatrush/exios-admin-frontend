import { Alert, Backdrop, Breadcrumbs, CircularProgress, FormControl, InputLabel, Link, MenuItem, Select, Snackbar, TextField, Typography } from '@mui/material'
import React, { Component } from 'react'
import api from '../../api';
import Card from '../../components/Card/Card';
import CustomButton from '../../components/CustomButton/CustomButton';

type Props = {}

type State = {
  formData: any
  isPending: boolean
  isSuccess: boolean
  errorMessage: string | null
  successMessage: string | null
}

const breadcrumbs = [
  <Link underline="hover" key="1" color="inherit" href="/">
    Home
  </Link>,
  <Link underline="hover" key="2" color="inherit" href="/invoices">
    Invoices
  </Link>,
  <Typography key="3" color='#28323C'>
    Add Unsure Order
  </Typography>,
];

class UnsureOrder extends Component<Props, State> {
  state: State = {
    formData: [],
    isPending: false,
    isSuccess: false,
    successMessage: null,
    errorMessage: null
  }

  submitForm = async (event: any) => {
    event.preventDefault();
    this.setState({ isPending: true });

    try {
      await api.post('unsureOrder/add', this.state.formData);
      this.setState({ isSuccess: true, successMessage: 'order created successfully' });
    } catch (error: any) {
      console.log(error);
      this.setState({ errorMessage: error.message, successMessage: null });
    } finally {
      this.setState({ isPending: false });
    }
  }

  handleChange = (event: any, checked?: any) => {
    const name = event.target.name;
    const value = event.target.inputMode === 'numeric' ? Number(event.target.value) : event.target.value;
      
    this.setState((oldValues) => ({
      formData: {
        ...oldValues.formData,
        [name]: value === 'on' ? checked : value
      }
    }))
  };

  render() {
    
    return (
      <div className="m-4 row">
        <div style={{ maxWidth: '1400px', margin: 'auto'}}>
          <div className="col-12 mb-3">
            <h4 className='mb-2'> Create Invoice</h4>
              <Breadcrumbs separator="›" aria-label="breadcrumb">
                {breadcrumbs}
              </Breadcrumbs>
          </div>
          <form
            className="row"
            onSubmit={(event) => this.submitForm(event)}
          >
            <Card>
              <div className="row">
                <p className='title'> Order Info </p>
                
                <div className="col-md-3 mb-4">
                  <TextField
                    id={'outlined-helperText'}
                    name="fullName"
                    required={true}
                    label={'Full Name'}
                    onChange={this.handleChange}
                    style={{ width: '100%' }}
                  />
                </div>
                <div className="col-md-3 mb-4">
                  <TextField
                    id={'outlined-helperText'}
                    required={true}
                    label={'Phone'}
                    name="phone"
                    onChange={this.handleChange}
                    style={{ width: '100%' }}
                  />
                </div>
                <div className="col-md-3 mb-4">
                  <FormControl style={{ width: '100%' }} required>
                    <InputLabel id="demo-select-small">Select Office</InputLabel>
                    <Select
                      labelId={'Select Office'}
                      id={'Select Office'}
                      label={'Select Office'}
                      name="placedAt"
                      onChange={this.handleChange}
                    >
                      <MenuItem value={'tripoli'}>
                        <em> Tripoli Office </em>
                      </MenuItem>
                      <MenuItem value={'benghazi'}>
                        <em> Benghazi Office </em>
                      </MenuItem>
                    </Select>
                  </FormControl>
                </div>

                <div className="col-md-3 mb-4">
                  <FormControl style={{ width: '100%' }} required>
                    <InputLabel id="demo-select-small">Shipment Method</InputLabel>
                    <Select
                      labelId={'Shipment Method'}
                      id={'Shipment Method'}
                      label={'Shipment Method'}
                      name="method"
                      onChange={this.handleChange}
                    >
                      <MenuItem value={'air'}>
                        <em> By Air </em>
                      </MenuItem>
                      <MenuItem value={'sea'}>
                        <em> By Sea </em>
                      </MenuItem>
                    </Select>
                  </FormControl>
                </div>

                <div className="col-md-3 mb-4">
                  <TextField
                    id={'outlined-helperText'}
                    required={true}
                    label={'Shipment From Where'}
                    name="fromWhere"
                    onChange={this.handleChange}
                  />
                </div>

                <div className="col-md-3 mb-4">
                  <TextField
                    id={'outlined-helperText'}
                    required={true}
                    label={'Shipment To Where'}
                    name="toWhere"
                    onChange={this.handleChange}
                  />
                </div>

                <div className="col-md-12 mb-2 text-end">
                  <CustomButton 
                    background='rgb(0, 171, 85)' 
                    size="small"
                  >
                    Create Order
                  </CustomButton>
                </div>
                
              </div>
            </Card>
          </form>
        </div>
        <Backdrop
          sx={{ color: '#fff', zIndex: (theme: any) => theme.zIndex.drawer + 1 }}
          open={this.state.isPending}
        >
          <CircularProgress color="inherit" />
        </Backdrop>

        <Snackbar 
          open={this.state.isSuccess ? true : false} 
          autoHideDuration={4000}
          onClose={() => this.setState({ isSuccess: false })}
        >
          <Alert 
            severity={this.state.errorMessage ? 'error' : 'success'}
            onClose={() => this.setState({ isSuccess: false })}
          >
            {this.state.errorMessage &&
              <p>{this.state.errorMessage}</p>
            }
            {this.state.successMessage &&
              <p>{this.state.successMessage}</p>
            }
          </Alert>
        </Snackbar>
      </div>
    )
  }
}

export default UnsureOrder;