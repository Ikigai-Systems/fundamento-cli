import axios from 'axios';

export class FundamentoClient {
  constructor(config) {
    this.config = config;
    this.axios = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    this.axios.interceptors.response.use(
      response => response,
      error => {
        if (error.response) {
          const message = error.response.data?.error || error.response.data?.message || error.response.statusText;
          throw new Error(`API Error (${error.response.status}): ${message}`);
        }
        throw error;
      }
    );
  }

  async listSpaces() {
    const response = await this.axios.get('/api/v1/spaces');
    return response.data;
  }

  async getSpace(npi) {
    const response = await this.axios.get(`/api/v1/spaces/${npi}`);
    return response.data;
  }

  async listDocuments(spaceNpi) {
    const response = await this.axios.get(`/api/v1/spaces/${spaceNpi}/documents`);
    return response.data;
  }

  async getDocument(npi, format = 'markdown') {
    const response = await this.axios.get(`/api/v1/documents/${npi}`);
    const document = response.data;

    if (format === 'json') {
      return document;
    }

    return document.content || '';
  }
}
