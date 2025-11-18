import express from "express";

const router = express.Router();

router.get("/status", (req, res) => {
  res.json({
    ok: true,
    service: "Musica API",
    version: "0.2-dev"
  });
});

export default router;