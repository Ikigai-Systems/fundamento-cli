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
          const data = error.response.data;
          const errors = data?.errors;
          const message = data?.error
            || data?.message
            || errorMessages(errors)
            || error.response.statusText;
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

  async archiveSpace(id) {
    const response = await this.axios.put(`/api/v1/spaces/${id}/archive`);
    return response.data;
  }

  async unarchiveSpace(id) {
    const response = await this.axios.put(`/api/v1/spaces/${id}/unarchive`);
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

  async createDocument(spaceId, { title, icon, markdown, parentDocumentId, file }) {
    if (file) {
      // Use multipart form data for file uploads
      const formData = new FormData();
      formData.append("document[file]", fs.createReadStream(file));
      if (title) {
        formData.append("document[title]", title);
      }
      if (icon) {
        formData.append("document[icon]", icon);
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
        document: withoutUndefined({
          title,
          icon,
          markdown,
          parent_document_id: parentDocumentId
        })
      }, {
        params: { space_id: spaceId }
      });
      return response.data;
    }
  }

  // Any of title, icon and markdown; the ones left undefined stay as they are.
  // An icon of "" removes it.
  async updateDocument(id, { title, icon, markdown }) {
    const response = await this.axios.patch(`/api/v1/documents/${id}`, {
      document: withoutUndefined({ title, icon, markdown })
    });
    return response.data;
  }

  // Either or both of name and icon; an icon of "" removes it.
  async updateTable(id, { name, icon }) {
    const response = await this.axios.patch(`/api/v1/tables/${id}`, {
      table: withoutUndefined({ name, icon })
    });
    return response.data;
  }

  async createImportSession({ spaceId, sourceFormat = "generic", settings = {} }) {
    const response = await this.axios.post("/api/v1/import_sessions", {
      space_id: spaceId,
      source_format: sourceFormat,
      settings
    });
    return response.data;
  }

  async submitManifest(sessionId, files) {
    const response = await this.axios.post(`/api/v1/import_sessions/${sessionId}/manifest`, { files });
    return response.data;
  }

  async markFileUploaded(sessionId, fileId) {
    const response = await this.axios.patch(
      `/api/v1/import_sessions/${sessionId}/import_files/${fileId}`,
      { status: "uploaded" }
    );
    return response.data;
  }

  async triggerProcessing(sessionId) {
    const response = await this.axios.post(`/api/v1/import_sessions/${sessionId}/process`);
    return response.data;
  }

  async getImportSession(sessionId) {
    const response = await this.axios.get(`/api/v1/import_sessions/${sessionId}`);
    return response.data;
  }

  async cancelImportSession(sessionId) {
    const response = await this.axios.delete(`/api/v1/import_sessions/${sessionId}`);
    return response.data;
  }

  async retryImportSession(sessionId) {
    const response = await this.axios.post(`/api/v1/import_sessions/${sessionId}/retry`);
    return response.data;
  }

  async evalFormula(formula, spaceId) {
    const response = await this.axios.post("/api/v1/formulas/eval", {
      formula,
      space_id: spaceId
    });
    return response.data;
  }
}

// Validation errors come as a list of messages or as an object of them keyed by field.
function errorMessages(errors) {
  if (Array.isArray(errors)) return errors.join(", ");
  if (errors && typeof errors === "object") return Object.values(errors).flat().join(", ");
  return null;
}

function withoutUndefined(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}
