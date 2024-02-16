import { base } from '../api';

export const addAuthInterceptor = (token: string) => {
  base.axios.interceptors.request.use((config: any) => {
		config.headers.authorization = `Bearer ${token}`;
		return config;
	});	
};
