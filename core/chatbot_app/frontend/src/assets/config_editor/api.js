import axios from 'axios';
import config from '../config';

const API_URL = `${config.API_BASE_URL}/config`;

export const getConfig = () => axios.get(API_URL);
export const updateConfig = (data) => axios.put(API_URL, data, { timeout: 3000 });