import express from "express";
import type { ErrorRequestHandler } from "express";
import { fileURLToPath } from "node:url";
import { calculatePrice } from "./pricing.js";
import { isProductArray } from "./validation.js";

export const app = express();

app.use(express.json({ limit: "1mb" }));

app.post("/reprice", (request, response) => {
  const body: unknown = request.body;

  if (!isProductArray(body)) {
    response.status(400).json({
      error:
        "Ожидается массив товаров: проверьте поля, цены, диапазон и конкурентов.",
    });
    return;
  }

  response.json(body.map(calculatePrice));
});

// After npm run build, the server also serves the React page.
app.use(express.static(fileURLToPath(new URL("../client", import.meta.url))));

const handleError: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  if (error instanceof SyntaxError && "body" in error) {
    response.status(400).json({ error: "Некорректный JSON." });
    return;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    error.status === 413
  ) {
    response
      .status(413)
      .json({ error: "Размер тела запроса не должен превышать 1 МБ." });
    return;
  }

  console.error(error);
  response.status(500).json({ error: "Внутренняя ошибка сервера." });
};

app.use(handleError);
