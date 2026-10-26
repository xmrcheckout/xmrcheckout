import { MIMEType } from "node:util";

// RFC 2046 section 5.1.1: 1-70 ASCII characters, without a trailing space.
const boundaryCharacters = /^[0-9A-Za-z'()+_,./:=? -]*[0-9A-Za-z'()+_,./:=?-]$/;

export function hasValidMultipartBoundary(contentType: string | null): boolean {
  if (!contentType || !contentType.trimStart().toLowerCase().startsWith("multipart/form-data")) {
    return true;
  }

  try {
    const mime = new MIMEType(contentType);
    const boundary = mime.params.get("boundary");
    return mime.essence === "multipart/form-data"
      && boundary !== null
      && boundary.length <= 70
      && boundaryCharacters.test(boundary);
  } catch {
    return false;
  }
}
