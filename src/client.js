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

  async getSpace(id) {
    const response = await this.axios.get(`/api/v1/spaces/${id}`);
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

  async listDocuments(spaceId) {
    const response = await this.axios.get("/api/v1/documents", {
      params: { space_id: spaceId }
    });
    return response.data;
  }

  async getDocument(id, format = "markdown") {
    const response = await this.axios.get(`/api/v1/documents/${id}.${format}`);
    return response.data;
  }

  async createDocument(spaceId, { title, markdown, parentDocumentId, file }) {
    if (file) {
      // Use multipart form data for file uploads
      const formData = new FormData();
      formData.append("document[file]", fs.createReadStream(file));
      if (title) {
        formData.append("document[title]", title);
      }
      if (parentDocumentId) {
        formData.append("document[parent_document_id]", parentDocumentId);
      }

      const response = await this.axios.post("/api/v1/documents", formData, {
        params: { space_id: spaceId },
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
          parent_document_id: parentDocumentId
        }
      }, {
        params: { space_id: spaceId }
      });
      return response.data;
    }
  }

  async updateDocument(id, { markdown }) {
    const response = await this.axios.patch(`/api/v1/documents/${id}`, {
      document: {
        markdown
      }
    });
    return response.data;
  }
}
