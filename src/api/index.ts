import axios, { AxiosInstance, AxiosRequestConfig, CancelTokenSource } from 'axios';

const endpoint = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/';

const defaultHeaders = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
};

class APIBase {
  
  public axios: AxiosInstance;
  private filesEndpoint: string;
  private headers: any = {};
  private cancelTokenSource: CancelTokenSource | null = null;

  constructor(endpoint: string, headers: any = {}) {
    this.filesEndpoint = `${endpoint}/files`;
    this.axios = axios.create({
      baseURL: endpoint,
      headers: { ...defaultHeaders, ...headers },
      // timeout: 10000,
    });
  }

  private createCancelTokenSource(): void {
    this.cancelTokenSource = axios.CancelToken.source();
  }
  
  public cancelRequests(): void {
    if (this.cancelTokenSource) {
      this.cancelTokenSource.cancel('Request canceled');
      this.cancelTokenSource = null; // Reset the source after canceling
    }
  }

  public getFileAckEndpoint(): string {
    return this.filesEndpoint + '/xlsx';
  }
  
  public getFilesEndpoint(): string {
    return this.filesEndpoint;
  }
  
  public post(url: string, body: object): Promise<any> {
    return this.send('post', `/${url}`, body);
  }
  
  public put(url: string, body: object): Promise<any> {
    return this.send('put', `/${url}`, body);
  }
  
  public delete(url: string, body: object): Promise<any> {
    return this.send('delete', `/${url}`, body);
  }
  
  public get(url: string, params?: any): Promise<any> {
    return this.send('get', `/${url}`, params);
  }
  
  public send(method: string, url: string, data?: any): any {

    // join array fields with ',' in query
    const param = method === 'get' ? data : null;
    if (param) {
      Object.keys(param).forEach(key => {
        if (param[key] instanceof Array) {
          param[key] = param[key].join(',');
        }
      });
    }
    this.createCancelTokenSource(); // Create a new cancel token source

    const requestConfig: AxiosRequestConfig = {
      data: method !== 'get' ? data : null,
      headers: this.headers,
      method,
      params: method === 'get' ? data : null,
      url,
      cancelToken: this.cancelTokenSource?.token, // Include cancel token here
    };

    const requestPromise = new Promise<any>((resolve, reject) => {
      this.axios
        .request(requestConfig)
        .then((response) => {
          resolve(response);
        })
        .catch((error) => {
          reject(error);
        });
    });
  
    return requestPromise;
    
    // return this.axios.request({
    //   data: method !== 'get' ? data : null,
    //   headers: this.headers,
    //   method,
    //   params: method === 'get' ? data : null,
    //   url,
    //   cancelToken: source.token, // Set the cancel token
    // }).catch((error) => {
    //   if (error.response) {
    //     // The request was made and the server responded with a status code
    //     // that falls out of the range of 2xx
    //     console.log(error.response);
        
    //     throw ApiError.decode(error.response);
    //   } else if (error.request) {
    //     // The request was made but no response was received
    //     // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
    //     // http.ClientRequest in node.js
    //   } else {
    //     // Something happened in setting up the request that triggered an Error
    //   }
    // });
  }
  
  public async fetchFormData(url: string, method: string, body: any) {
    let response;
    try {
      response = await fetch(endpoint + url, {
        method,
        body,
        headers: {
          ...this.headers,
          authorization: "Bearer " + localStorage.getItem('authToken')
        },
      })
      response = await response.json();
      
    } catch (error) {
      response = error;
    }
    return response;
  }
}

export class ApiError {

  public static decode(json: any): ApiError {
    return Object.assign(Object.create(ApiError.prototype), json);
  }

  public data: any;
  public headers: any;
  public isNetworkError: boolean;

  constructor(isNetworkError: boolean) {
    this.isNetworkError = isNetworkError;
  }

}

export const base = new APIBase(endpoint);

// eslint-disable-next-line import/no-anonymous-default-export
export default {
  // region common
  post: (url: string, body: object) => base.post(url, body),

  get: (url: string, body?: object) => base.get(url, body),

  update: (url: string, body: object) => base.put(url, body),

  delete: (url: string, body: object) => base.delete(url, body),

  fetchFormData: (url: string, method: string, body: any) => base.fetchFormData(url, method, body)
}
