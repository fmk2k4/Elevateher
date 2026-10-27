const UPLOAD_URL = process.env.NEXT_PUBLIC_UPLOAD_URL || process.env.VITE_UPLOAD_URL || '/api/upload';

async function upload({
  url,
  buffer,
  base64
}) {
  const response = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: {
      "Content-Type": buffer ? "application/octet-stream" : "application/json"
    },
    body: buffer ? buffer : JSON.stringify({ base64, url })
  });
  const data = await response.json();
  return {
    url: data.url,
    mimeType: data.mimeType || null
  };
}
export { upload };
export default upload;