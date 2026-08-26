const MIN_PART_SIZE = 5 * 1024 * 1024; // R2 requires 5MiB minimum except the last part

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        try {
            // POST /multipart/create  { key }
            if (url.pathname === "/multipart/create" && request.method === "POST") {
                const { key } = await request.json();
                if (!key) return json({ error: "key is required" }, 400, corsHeaders);

                const multipartUpload = await env.MY_BUCKET.createMultipartUpload(key);
                return json({ key: multipartUpload.key, uploadId: multipartUpload.uploadId }, 200, corsHeaders);
            }

            // PUT /multipart/part?key=...&uploadId=...&partNumber=...
            if (url.pathname === "/multipart/part" && request.method === "PUT") {
                const key = url.searchParams.get("key");
                const uploadId = url.searchParams.get("uploadId");
                const partNumber = Number(url.searchParams.get("partNumber"));

                if (!key || !uploadId || !partNumber) {
                    return json({ error: "key, uploadId, partNumber are required" }, 400, corsHeaders);
                }

                const multipartUpload = env.MY_BUCKET.resumeMultipartUpload(key, uploadId);
                const uploadedPart = await multipartUpload.uploadPart(partNumber, request.body);

                return json({ partNumber: uploadedPart.partNumber, etag: uploadedPart.etag }, 200, corsHeaders);
            }

            // POST /multipart/complete  { key, uploadId, parts: [{partNumber, etag}] }
            if (url.pathname === "/multipart/complete" && request.method === "POST") {
                const { key, uploadId, parts } = await request.json();
                if (!key || !uploadId || !Array.isArray(parts) || !parts.length) {
                    return json({ error: "key, uploadId, parts are required" }, 400, corsHeaders);
                }

                const multipartUpload = env.MY_BUCKET.resumeMultipartUpload(key, uploadId);
                const object = await multipartUpload.complete(parts);

                const publicUrl = `${env.PUBLIC_BUCKET_URL}/${key}`;
                return json({ key: object.key, etag: object.httpEtag, publicUrl }, 200, corsHeaders);
            }

            // POST /multipart/abort  { key, uploadId }
            if (url.pathname === "/multipart/abort" && request.method === "POST") {
                const { key, uploadId } = await request.json();
                const multipartUpload = env.MY_BUCKET.resumeMultipartUpload(key, uploadId);
                await multipartUpload.abort();
                return json({ aborted: true }, 200, corsHeaders);
            }

            return json({ error: "not found" }, 404, corsHeaders);
        } catch (err) {
            return json({ error: `Multipart operation failed: ${err.message || err}` }, 500, corsHeaders);
        }
    },
};

function json(body, status, headers) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", ...headers },
    });
}
