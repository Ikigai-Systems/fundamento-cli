import axios from "axios";
import FormData from "form-data";
import fs from "fs";

export class FundamentoClient {
  constructor(config) {
    this.config = config;
    this.axios = axios.create({
      baseURL: config.baseUrl,
      headers: {
        "Authorization": `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
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
    const response = await this.axios.get("/api/v1/spaces");
    return response.data;
  }

  async getSpace(npi) {
    const response = await this.axios.get(`/api/v1/spaces/${npi}`);
    return response.data;
  }

  async createSpace({ name, accessMode }) {
    const response = await this.axios.post("/api/v1/spaces", {
      space: {
        name,
        access_mode: accessMode
      }
    });
    return response.data;
  }

  async listDocuments(spaceNpi) {
    const response = await this.axios.get(`/api/v1/spaces/${spaceNpi}/documents`);
    return response.data;
  }

  async getDocument(npi, format = "markdown") {
    const response = await this.axios.get(`/api/v1/documents/${npi}.${format}`);
    return response.data;
  }

  async createDocument(spaceNpi, { title, markdown, parentDocumentNpi, file }) {
    if (file) {
      // Use multipart form data for file uploads
      const formData = new FormData();
      formData.append("document[file]", fs.createReadStream(file));
      if (title) {
        formData.append("document[title]", title);
      }
      if (parentDocumentNpi) {
        formData.append("document[parent_document_npi]", parentDocumentNpi);
      }

      const response = await this.axios.post("/api/v1/documents", formData, {
        params: { space_npi: spaceNpi },
        headers: {
          ...formData.getHeaders(),
          "Authorization": `Bearer ${this.config.apiKey}`
        }
      });
      return response.data;
    } else {
      // Use JSON for markdown content
      const response = await this.axios.post("/api/v1/documents", {
        document: {
          title,
          markdown,
          parent_document_npi: parentDocumentNpi
        }
      }, {
        params: { space_npi: spaceNpi }
      });
      return response.data;
    }
  }

  async updateDocument(npi, { markdown }) {
    const response = await this.axios.patch(`/api/v1/documents/${npi}`, {
      document: {
        markdown
      }
    });
    return response.data;
  }
}
