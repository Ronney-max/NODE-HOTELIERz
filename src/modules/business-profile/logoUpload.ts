import fs from "node:fs";
import path from "node:path";
import multer from "multer";

// Resolved from process.cwd(), not import.meta.url: pm2/npm run build always
// run with cwd = the repo root, so this is identical between `tsx watch`
// (dev, running from src/) and `node dist/...` (prod) — an import.meta.url
// -relative path would only coincidentally match since dev/prod mirror
// src/ and dist/ at the same depth today.
export const LOGO_UPLOAD_DIR = path.resolve(process.cwd(), "uploads", "logos");
fs.mkdirSync(LOGO_UPLOAD_DIR, { recursive: true });

// SVG is deliberately excluded: it's XML and can embed <script>/event-handler
// attributes, so accepting tenant-uploaded SVGs served same-origin would be
// a stored-XSS vector. Raster-only sidesteps that without needing a sanitizer.
const ALLOWED_MIME_EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, LOGO_UPLOAD_DIR),
  filename: (req, file, cb) => {
    // Extension comes from a mimetype whitelist, never the client-supplied
    // original filename, to avoid any path-traversal/extension-spoofing surface.
    const ext = ALLOWED_MIME_EXTENSIONS[file.mimetype] ?? "";
    const tenantId = req.tenantId ?? "unknown";
    cb(null, `${tenantId}-${Date.now()}${ext}`);
  },
});

export const logoUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_EXTENSIONS[file.mimetype]) {
      cb(new Error("Only PNG, JPG, WEBP, or GIF images are accepted"));
      return;
    }
    cb(null, true);
  },
});
