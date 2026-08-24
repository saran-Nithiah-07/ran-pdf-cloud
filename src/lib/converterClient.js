import { supabase } from "./supabaseClient";

const CONVERTER_URL = import.meta.env.VITE_CONVERTER_URL;

if (!CONVERTER_URL) {
  console.error(
    "Missing VITE_CONVERTER_URL. Set it to your deployed converter service's URL " +
      "(e.g. https://pdfinity-converter.onrender.com) in .env."
  );
}

function parseFilename(disposition) {
  if (!disposition) return null;
  const match = disposition.match(/filename="?([^";\n]+)"?/i);
  return match ? match[1] : null;
}

/**
 * Uploads a file to the given conversion endpoint and resolves with the
 * converted file's blob + suggested filename. Reports real upload
 * progress via XHR (fetch can't do this natively) — there's no equivalent
 * signal for the server-side conversion step itself, since that's a
 * single request/response with no streaming status, so callers should
 * treat "upload done" as the point to switch to an indeterminate
 * "converting…" state rather than a fake progress number.
 */
export function convertFile(toolSlug, file, onUploadProgress, onXhrReady) {
  return new Promise(async (resolve, reject) => {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      reject(new Error("Your session has expired. Please sign in again."));
      return;
    }

    const xhr = new XMLHttpRequest();
    if (onXhrReady) onXhrReady(xhr);
    xhr.open("POST", `${CONVERTER_URL}/convert/${toolSlug}`);
    xhr.responseType = "blob";
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onUploadProgress) {
        onUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onabort = () => {
      const abortError = new Error("Cancelled.");
      abortError.aborted = true;
      reject(abortError);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const filename = parseFilename(xhr.getResponseHeader("Content-Disposition"));
        resolve({ blob: xhr.response, filename });
        return;
      }

      // Error responses are JSON, but responseType is set to "blob" for
      // the success path, so we have to read the blob back out as text.
      const reader = new FileReader();
      reader.onload = () => {
        let detail = `Conversion failed (${xhr.status}).`;
        try {
          const parsed = JSON.parse(reader.result);
          if (parsed.detail) detail = parsed.detail;
        } catch {
          // Non-JSON error body — fall back to the generic message above.
        }
        reject(new Error(detail));
      };
      reader.onerror = () => reject(new Error(`Conversion failed (${xhr.status}).`));
      reader.readAsText(xhr.response);
    };

    xhr.onerror = () => reject(new Error("Network error while contacting the converter."));

    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
