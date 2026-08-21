"use strict";

const BOARDS = Object.freeze({
  accessories: "Аксессуары",
  womenShoes: "Женская обувь",
  womenClothes: "Женская одежда",
  cosmetics: "Косметика для лица и тела",
  swimwear: "Купальник",
  jackets: "Куртки",
  menShoes: "Мужская обувь",
  menClothes: "Мужская одежда, бренды из США, купим и доставим",
  underwear: "Нижнее белье и домашняя одежда",
  reviews: "Отзывы",
  glasses: "Очки",
  bags: "Сумки женские и мужские",
});

function inferBoard(product, audienceKey) {
  if (!product || typeof product !== "object") return "";
  const kind = product.boardKind;
  const type = product.type;
  if (kind === "куртки" || type === "куртка") return BOARDS.jackets;
  if (kind === "купальник" || type === "купальник") return BOARDS.swimwear;
  if (kind === "очки" || type === "очки") return BOARDS.glasses;
  if (kind === "сумки" || type === "сумка") return BOARDS.bags;
  if (kind === "косметика") return BOARDS.cosmetics;
  if (kind === "белье") return BOARDS.underwear;
  if (kind === "аксессуары") return BOARDS.accessories;
  if (kind === "обувь") {
    if (audienceKey === "women") return BOARDS.womenShoes;
    if (audienceKey === "men") return BOARDS.menShoes;
    return "";
  }
  if (kind === "одежда") {
    if (audienceKey === "women") return BOARDS.womenClothes;
    if (audienceKey === "men") return BOARDS.menClothes;
    return "";
  }
  return "";
}

module.exports = {
  BOARDS,
  inferBoard,
};
