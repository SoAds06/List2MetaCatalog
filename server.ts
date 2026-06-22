import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set body limits high to handle base64 image transfers
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API Route: Check upload status and config status
  app.get("/api/status", (req, res) => {
    res.json({
      success: true,
      imgbbConfigured: !!process.env.IMGBB_API_KEY,
    });
  });

  // API Route: Secure Proxy to upload to ImgBB
  app.post("/api/upload", async (req, res) => {
    let base64Data = req.body.image;
    if (!base64Data) {
      return res.status(400).json({
        success: false,
        error: "IMAGE_MISSING",
        message: "Görsel verisi gönderilmedi.",
      });
    }

    // Strip out base64 URI scheme header if present
    if (base64Data.startsWith("data:")) {
      const parts = base64Data.split(";base64,");
      if (parts.length > 1) {
        base64Data = parts[1];
      }
    }

    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: "IMGBB_API_KEY_MISSING",
        message: "Ortam değişkenlerinde IMGBB_API_KEY tanımlanmamış. Kalıcı yükleme için lütfen AI Studio Secrets panelinden bu değişkeni ayarlayın.",
      });
    }

    try {
      const formData = new URLSearchParams();
      formData.append("image", base64Data);

      const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        const errorDetails = await response.text();
        return res.status(response.status).json({
          success: false,
          error: "IMGBB_API_ERROR",
          message: "ImgBB sunucusu istek karşısında hata döndürdü.",
          details: errorDetails,
        });
      }

      const result = await response.json();
      if (result && result.success && result.data && result.data.url) {
        return res.json({
          success: true,
          url: result.data.url,
          delete_url: result.data.delete_url || "",
        });
      } else {
        return res.status(500).json({
          success: false,
          error: "IMGBB_INVALID_RESPONSE",
          message: "ImgBB geçersiz bir yanıt döndürdü.",
          details: result,
        });
      }
    } catch (error: any) {
      console.error("ImgBB uploads proxy error:", error);
      return res.status(500).json({
        success: false,
        error: "SERVER_UPLOAD_FAILED",
        message: "Resim ImgBB'ye yüklenirken beklenmeyen bir hata oluştu.",
        details: error.message || error,
      });
    }
  });

  // Handle frontend routes/assets
  if (process.env.NODE_ENV !== "production") {
    // In development mode, load Vite server as a middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server started on http://localhost:${PORT}`);
  });
}

startServer();
