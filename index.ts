const axios = require("axios");
import { Product } from "./interfaces/product.interface";
import { Products } from "./interfaces/products.interface";

interface PriceRange {
  minPrice: number;
  maxPrice: number;
}

const fetchProducts = (minPrice: number, maxPrice: number): Promise<Products> =>
  axios.get(
    `https://api.ecommerce.com/products?minPrice=${minPrice}&maxPrice=${maxPrice}`
  );

const fetchAllProducts = async (ranges: PriceRange[]): Promise<Product[]> =>
  ranges.reduce(
    (chain, range) =>
      chain.then((acc: Product[]) =>
        fetchProducts(range.minPrice, range.maxPrice).then((res) =>
          acc.concat(res.products)
        )
      ),
    Promise.resolve([] as Product[])
  );

const splitRange = (
  minPrice: number,
  maxPrice: number,
  parts: number
): PriceRange[] => {
  const step = (maxPrice - minPrice) / parts;

  const ranges: PriceRange[] = [];
  let current = minPrice;
  while (current <= maxPrice) {
    ranges.push({
      minPrice: current + (ranges.length > 0 ? 0.01 : 0),
      maxPrice: current + step,
    });

    current += step;
  }
  return ranges;
};

const findPriceRanges = async (
  minPrice: number,
  maxPrice: number
): Promise<PriceRange[]> => {
  const result: PriceRange[] = [];

  const page = await fetchProducts(minPrice, maxPrice);

  // all products for price range filter is returned
  // move on to next price range
  if (page.count === page.total) {
    result.push({ minPrice, maxPrice });
  }
  // api has extra products than returned count
  else {
    // divide as integer and plus one if there is an extra
    const parts =
      (page.total - (page.total % page.count)) / page.count +
      (page.total % page.count === 0 ? 0 : 1);

    const extra = splitRange(minPrice, maxPrice, parts);
    // do same "range find" process for all extra ranges from current call
    const extraRanges = await Promise.all(
      extra.map((range) => findPriceRanges(range.minPrice, range.maxPrice))
    ).then((res) => res.reduce((acc, r) => acc.concat(r), []));

    result.push(...extraRanges);
  }

  return result;
};

// initially try to fetch all products total value
// so we use price range from zero to max price we can think of
// based on if response's total is more than response's count
// we create a new price range by dividing initial range by two
// and then check both of those. if same occurs for any new range
// we divide that range again. finally we should have all price ranges
// where response's count is less than or equal to response's total
// finally we make fetch products requests with all price ranges and save results.
findPriceRanges(0, 100000)
  .then(fetchAllProducts)
  .then((products) => console.log("done: ", products.length))
  .catch(console.error);
