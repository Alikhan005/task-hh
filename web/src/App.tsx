import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import sampleProducts from "../../data/products.json";
import { isProductArray } from "../../src/validation";
import type { PriceResult, Product, Reason } from "../../src/types";

interface Row {
  product: Product;
  result: PriceResult;
}

const sampleJson = JSON.stringify(sampleProducts, null, 2);
const priceFormat = new Intl.NumberFormat("ru-KZ", {
  maximumFractionDigits: 2,
});
const reasons: Record<Reason, string> = {
  UNDERCUT: "Цена по конкуренту",
  AT_MIN: "Достигнут минимум",
  AT_MAX: "Достигнут максимум",
  NO_COMPETITORS: "Нет конкурентов в наличии",
};

function money(price: number): string {
  return `${priceFormat.format(price)} ₸`;
}

async function fetchPrices(
  products: Product[],
  signal?: AbortSignal,
): Promise<PriceResult[]> {
  const response = await fetch("/reprice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(products),
    signal,
  });

  const data: unknown = await response.json();

  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : `Ошибка сервера: ${response.status}`;
    throw new Error(message);
  }

  return data as PriceResult[];
}

export function App() {
  const [input, setInput] = useState(sampleJson);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function calculate(products: Product[], signal?: AbortSignal) {
    setLoading(true);
    setError(null);

    try {
      const results = await fetchPrices(products, signal);
      if (!signal?.aborted) {
        // The API returns results in the same order, including duplicate SKUs.
        setRows(
          results.map((result, index) => ({
            product: products[index],
            result,
          })),
        );
      }
    } catch (cause) {
      if (!signal?.aborted) {
        setRows([]);
        setError(
          cause instanceof Error
            ? cause.message
            : "Не удалось выполнить запрос.",
        );
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void calculate(sampleProducts, controller.signal);
    return () => controller.abort();
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const parsed: unknown = JSON.parse(input);
      if (!isProductArray(parsed)) {
        throw new Error(
          "Нужен массив товаров с корректными полями и диапазоном цен.",
        );
      }
      void calculate(parsed);
    } catch (cause) {
      setRows([]);
      setError(
        cause instanceof SyntaxError
          ? "Некорректный JSON. Проверьте запятые, кавычки и скобки."
          : cause instanceof Error
            ? cause.message
            : "Не удалось прочитать данные.",
      );
    }
  }

  const reduced = rows.filter(
    ({ result }) => result.newPrice < result.oldPrice,
  ).length;
  const withoutCompetitors = rows.filter(
    ({ result }) => result.reason === "NO_COMPETITORS",
  ).length;

  return (
    <div className="page">
      <header className="topbar">
        <a className="brand" href="/" aria-label="SaleScout — главная">
          <span className="brand-mark" aria-hidden="true">
            S
          </span>
          SaleScout
        </a>
        <span className="demo-label">Прайс-бот · демо</span>
      </header>

      <main>
        <div className="intro">
          <p className="eyebrow">УПРАВЛЕНИЕ ЦЕНАМИ</p>
          <h1>Пересчёт цен</h1>
          <p>
            Цена по доступным конкурентам, с учётом вашего диапазона и шага.
          </p>
        </div>

        <section className="stats" aria-label="Результат последнего расчёта">
          <div>
            <span>Товаров</span>
            <strong>{rows.length}</strong>
          </div>
          <div>
            <span>Цена снижена</span>
            <strong>{reduced}</strong>
          </div>
          <div>
            <span>Без конкурентов</span>
            <strong>{withoutCompetitors}</strong>
          </div>
        </section>

        <section
          className="panel results"
          aria-labelledby="results-title"
          aria-busy={loading}
        >
          <div className="panel-heading">
            <div>
              <h2 id="results-title">Было / стало</h2>
              <p>Результат последнего расчёта · цены в тенге</p>
            </div>
            <span className="count">{rows.length} товаров</span>
          </div>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">SKU</th>
                  <th scope="col">Товар</th>
                  <th scope="col" className="numeric">
                    Было
                  </th>
                  <th scope="col" className="numeric">
                    Стало
                  </th>
                  <th scope="col">Причина</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ product, result }, index) => (
                  <tr key={`${result.sku}-${index}`}>
                    <td className="sku">{result.sku}</td>
                    <td className="product-name">{product.name}</td>
                    <td className="numeric old-price">
                      {money(result.oldPrice)}
                    </td>
                    <td className="numeric new-price">
                      {money(result.newPrice)}
                    </td>
                    <td>
                      <span className={`reason reason-${result.reason}`}>
                        {result.reason}
                      </span>
                      <span className="reason-description">
                        {reasons[result.reason]}
                      </span>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty" aria-live="polite">
                      {loading
                        ? "Пересчитываем цены…"
                        : error
                          ? "Исправьте данные и повторите расчёт."
                          : "Список товаров пуст."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel input-panel" aria-labelledby="input-title">
          <div className="panel-heading">
            <div>
              <h2 id="input-title">Проверить свои товары</h2>
              <p>
                Измените цены, шаг или наличие конкурентов и повторите расчёт.
              </p>
            </div>
            <button
              className="secondary"
              type="button"
              disabled={loading}
              onClick={() => {
                setInput(sampleJson);
                void calculate(sampleProducts);
              }}
            >
              Вернуть пример
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <label htmlFor="products-json">Массив товаров (JSON)</label>
            <textarea
              id="products-json"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              spellCheck={false}
              disabled={loading}
            />
            <div className="form-footer">
              <span>
                Учитываем только конкурентов с <code>inStock: true</code>.
              </span>
              <button className="primary" type="submit" disabled={loading}>
                {loading ? "Пересчитываем…" : "Пересчитать цены"}
              </button>
            </div>
          </form>
        </section>

        <footer>
          Демонстрационный расчёт. Изменения цен на Kaspi не выполняются.
        </footer>
      </main>
    </div>
  );
}
