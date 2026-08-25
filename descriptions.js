"use strict";

const MISSING_DESCRIPTION = "нет подходящего описания";
const CTA_ASSORTIMENT = "жми «Перейти», чтобы заказать и просмотреть весь ассортимент";
const CTA_CHANNEL = "Где купить? Жми «Перейти», вся информация в канале!";
const CTA_BUTTON = "Перейти";

const DESCRIPTIONS = Object.freeze([
  {
    id: "victoria-secret",
    brands: ["victoria's secret", "victorias secret", "victoria secret", "виктория сикрет", "виктории сикрет"],
    keywords:
      "Пижамы Victoria Secret, пижама Виктория Сикрет, пижама женская Виктория Сикрет, эстетика пижам Victoria's Secret, атласная пижама, стильные образы с пижамами, купить пижаму Victoria Secret, стильные женские пижамы, одежда для сна, сатиновая пижама Victoria's Secret, атласная пижама Victoria's Secret, шелковая пижама Victoria's Secret, купить пижаму Victoria's Secret, пижама Victoria's Secret в полоску, пижама Victoria's Secret оригинал, пижама Victoria's Secret плюс-сайз, нижнее белье Victoria's Secret, комплект белья, сексуальное белье, кружевное белье, комфортное белье, брендовое белье, стильное белье, женская пижама, домашняя одежда, пижама из хлопка, пуш-ап, брендовые пижамы, Victoria's Secret sale, ангелы Виктории Сикрет, халат Victoria's Secret",
  },
  {
    id: "new-balance-sneakers",
    brands: ["new balance", "нью баланс"],
    boardKinds: ["обувь"],
    types: ["кроссовки", "кеды"],
    cta: CTA_CHANNEL,
    keywords:
      "Кроссовки женские и мужские, купить кроссовки, кроссовки new balance, белые кроссовки, летние кроссовки, весенние кроссовки, осенние кроссовки, осенняя обувь, кроссовки оригинал, кроссовки для бега, оригинальные кроссовки, модели кроссовок, где купить кроссовки, спортивная обувь, стильные кроссовки, женские кроссовки New Balance, мужские кроссовки New Balance, кроссовки для бега New Balance, лайфстайл кроссовки New Balance, модные кроссовки New Balance 2026, Кроссовки New Balance эстетика, Образы с кроссовками New Balance, Кроссовки NB, New balance 530, new balance 574, new balance 2002R, new balance 550, new balance FuelCell, new balance WRPD, кроссовки New Balance 9060, кроссовки New Balance 1906R",
  },
  {
    id: "marc-jacobs-bags",
    brands: ["marc jacobs", "марк джейкобс"],
    boardKinds: ["сумки"],
    types: ["сумка", "рюкзак"],
    cta: "Жми «Перейти» и узнай где купить сумки Marc Jacobs по выгодной цене!",
    keywords:
      "женские сумки и рюкзаки, мужские сумки и рюкзаки, стильные сумки, модные сумки, брендовые рюкзаки, сумки из сша, оригинальные сумки, модные сумки, сумки на каждый день, лучшие женские сумки 2026, сумки 2026 тренд, универсальные сумки, марк джейкобс сумки, сумка Marc Jacobs, Marc Jacobs, Marc Jacobs сумка, сумка через плечо Marc Jacobs, кожаная сумка Marc Jacobs, нейлоновая сумка Marc Jacobs, черная сумка Marc Jacobs, белая сумка Marc Jacobs, розовая сумка Marc Jacobs, голубая сумка Marc Jacobs, синяя сумка Marc Jacobs, красная сумка Marc Jacobs, сумка с принтом Marc Jacobs, стильная сумка Marc Jacobs, сумка The Snapshot, клатч Marc Jacobs, вместительная сумка Marc Jacobs, кросс-боди Marc Jacobs",
  },
  {
    id: "dkny-bags",
    brands: ["dkny"],
    boardKinds: ["сумки"],
    types: ["сумка", "рюкзак"],
    cta: CTA_ASSORTIMENT,
    keywords:
      "женские сумки и рюкзаки, мужские сумки и рюкзаки, стильные сумки, модные сумки, брендовые рюкзаки, сумки из сша, оригинальные сумки, модные сумки, сумки на каждый день, брендовые вещи из сша, как выбрать оригинальную сумку, лучшие женские сумки 2026, сумки 2026 тренд, подборка сумок из сша оригинал, брендовые сумки оригинал, сумки для лета, сумки для осени, сумки для зимы, универсальные сумки, сумка DKNY, женская сумка DKNY, кожаная сумка DKNY, сумка через плечо DKNY, кросс-боди DKNY, тоут DKNY, большая сумка DKNY, сумка DKNY с логотипом, DKNY bags",
  },
  {
    id: "dkny-clothes",
    brands: ["dkny"],
    boardKinds: ["одежда", "куртки", "купальник"],
    cta: CTA_CHANNEL,
    keywords:
      "Женская оригинальная брендовая одежда, женские футболки майки, женские шорты, женские джинсы, женские костюмы, женские рубашки, женские брюки, женские платья, женский комбинезон, женский лонгслив, брендовая одежда 2026, трендовые женские модели 2026, женский стиль 2026, как составить капсульный гардероб женский, летние образы, осенние образы, DKNY одежда, DKNY стиль, DKNY мода, DKNY коллекция, DKNY платья, DKNY спортивные костюмы, DKNY куртки, DKNY свитшоты, DKNY джинсы, DKNY женская одежда, одежда DKNY купить",
  },
  {
    id: "dkny-sneakers",
    brands: ["dkny"],
    boardKinds: ["обувь"],
    types: ["кроссовки", "кеды"],
    cta: CTA_ASSORTIMENT,
    keywords:
      "Кроссовки женские и мужские, купить кроссовки, кроссовки DKNY, белые кроссовки, летние кроссовки, весенние кроссовки, осенние кроссовки, осенняя обувь, кроссовки оригинал, кроссовки для бега, оригинальные кроссовки, модели кроссовок, где купить кроссовки, спортивная обувь, стильные кроссовки, женские кроссовки DKNY, мужские кроссовки DKNY, кроссовки DKNY оригинал, городские кроссовки DKNY, кеды DKNY, DKNY sneakers, Donna Karan кроссовки, обувь DKNY, DKNY обувь из США, модные кроссовки DKNY 2026, кроссовки DKNY эстетика, образы с кроссовками DKNY, белые кроссовки DKNY, черные кроссовки DKNY, кожаные кроссовки DKNY, кроссовки DKNY на каждый день",
  },
  {
    id: "dkny-shoes",
    brands: ["dkny"],
    types: ["туфли", "ботинки", "сапоги", "угги"],
    cta: CTA_ASSORTIMENT,
    keywords:
      "женская обувь, туфли женские, купить туфли, туфли DKNY, женские туфли DKNY, кожаные туфли DKNY, туфли на каблуке DKNY, туфли на шпильке DKNY, лодочки DKNY, туфли на каждый день DKNY, черные туфли DKNY, белые туфли DKNY, бежевые туфли DKNY, офисные туфли DKNY, вечерние туфли DKNY, летние туфли, осенняя обувь, обувь оригинал, стильная женская обувь, модная женская обувь 2026, обувь DKNY, DKNY обувь из США, Donna Karan туфли, DKNY heels, DKNY pumps, ботинки DKNY, сапоги DKNY, образы с туфлями DKNY, туфли DKNY эстетика",
  },
  {
    id: "coach-bags",
    brands: ["coach"],
    boardKinds: ["сумки"],
    types: ["сумка", "рюкзак"],
    cta: CTA_ASSORTIMENT,
    keywords:
      "женские сумки и рюкзаки, мужские сумки и рюкзаки, стильные сумки, модные сумки, брендовые рюкзаки, сумки из сша, оригинальные сумки, модные сумки, брендовые вещи из сша, как выбрать оригинальную сумку, лучшие женские сумки 2026, сумки 2026 тренд, подборка сумок из сша оригинал, брендовые сумки оригинал, сумки для лета, сумки для осени, сумки для зимы, универсальные сумки, сумки coach, сумка coach, coach tabby, оригинальные сумки Coach, кожаные сумки Coach, сумки Coach из США, купить сумку Coach, сумка Coach с шармом, элегантные сумки Coach, стильные сумки Coach, модные сумки Coach 2026, Coach сумки тоут, Coach сумки на плечо, Coach кросс-боди, рюкзаки Coach, брелок вишенка Coach, кошелек Coach",
  },
  {
    id: "nike-sneakers",
    brands: ["nike", "найк", "air jordan", "jordan"],
    boardKinds: ["обувь"],
    types: ["кроссовки", "кеды"],
    cta: CTA_ASSORTIMENT,
    keywords:
      "Кроссовки женские и мужские, купить кроссовки, кроссовки nike, белые кроссовки, летние кроссовки, весенние кроссовки, осенние кроссовки, осенняя обувь мужская, кроссовки оригинал, кроссовки для бега, оригинальные кроссовки, модели кроссовок, где купить кроссовки, купить сезонные кроссовки, спортивная обувь, топ кроссовок, новая обувь кроссовки, стильная обувь мужская, Nike Air Max, Nike Air Jordan, Nike Dunk, Nike Air Force, Nike Cortez, Nike React, Nike Metcon, Nike SB Janoski, городские кроссовки, ретро кроссовки Nike, кроссовки найк, кроссовки 2026 nike, найк кортез, найки эйр макс, nike Cortez шоколадные, Nike Dunk Low, Nike Dunk Low кожаные оригинал",
  },
  {
    id: "jw-pei-bags",
    brands: ["jw pei"],
    boardKinds: ["сумки"],
    types: ["сумка", "рюкзак"],
    cta: CTA_ASSORTIMENT,
    keywords:
      "женские сумки и рюкзаки, мужские сумки и рюкзаки, стильные сумки, брендовые рюкзаки, сумки из сша, оригинальные сумки, модные сумки, сумки на каждый день, брендовые вещи из сша, как выбрать оригинальную сумку, лучшие женские сумки 2026, сумки 2026 тренд, подборка сумок из сша оригинал, брендовые сумки оригинал, сумки для лета, сумки для осени, сумки для зимы, универсальные сумки, Стильные женские сумки из США, JW PEI, JW PEI сумки, JW PEI outfit, JW PEI аутфит, элегантные сумки JW PEI, JW PEI женская сумка, JW PEI мини сумка, JW PEI кроссбоди, JW PEI тоут, JW PEI багет сумка, JW PEI сумка купить, JW PEI стильные сумки, JW PEI экологичные сумки, JW PEI сумка с магнитной застежкой, JW PEI сумка через плечо",
  },
  {
    id: "watches",
    types: ["часы"],
    nameIncludes: ["часы"],
    cta: CTA_ASSORTIMENT,
    keywords:
      "женские часы, мужские часы, стильные часы, брендовые часы, аутфит с часами, оригинальные часы, модные часы, часы на каждый день, брендовые вещи из сша, как выбрать оригинальные часы, лучшие часы 2026, часы 2026 тренд, подборка часов из сша оригинал, брендовые часы оригинал, Designer watches, original brands, USA fashion accessories, nike, adidas, new balance, tommy hilfiger, ck, guess, karl lagerfeld, marc jacobs, burker, часы michael kors, часы Armani Exchange, часы Diesel, часы Tommy Hilfiger, часы Gevril GV2, часы наручные часы",
  },
  {
    id: "women-clothes",
    boardKinds: ["одежда", "куртки", "купальник"],
    audience: "women",
    keywords:
      "Женская оригинальная брендовая одежда, женские футболки майки, женские шорты, женские джинсы, женские костюмы, женские рубашки, женские брюки, женские платья, женский комбинезон, женский лонгслив, одежда из сша, брендовая одежда 2026, стиль на каждый день, женский образ, капсульный гардероб, подборка женской одежды, трендовые женские модели 2026, оригинальные вещи от брендов из сша 2026, женский стиль 2026, как составить капсульный гардероб женский, летние образы, осенние образы, nike, adidas, new balance, tommy hilfiger, ck, куртка Zara, зимняя куртка Zara",
  },
  {
    id: "timberland-men-shoes",
    brands: ["timberland", "тимберленд", "тимберы"],
    boardKinds: ["обувь"],
    audience: "men",
    cta: "жми «Перейти», больше ассортимента в моем тг-канале @kupim_v_usa",
    keywords:
      "мужская обувь, кроссовки, ботинки, лоферы, дерби, сникеры, топсайдеры, классическая обувь, обувь на каждый день, зимняя мужская обувь, стильная обувь, кожаные ботинки, бренд, брендовая обувь, летняя обувь, удобная обувь, мужские туфли, мужская обувь для повседневного стиля на лето осень весну зиму 2026 и 2026 года, nike, adidas, new balance, tommy hilfiger, ck, timberland, универсальная обувь, трендовая обувь, легкая обувь, оригинальные бренды, подборка обуви, мужские ботинки Timberland, Timberland мужская обувь, мужские тимберленды, Timberland мужские полуботинки, Timberland мужская обувь из замши, Тимберы, Timberland мужские, Ботинки Timberland, Timberland аутфит, Timberland outfit, кроссовки Timberland, Кроссовки женские и мужские, купить кроссовки, кроссовки new balance, белые кроссовки, летние кроссовки, весенние кроссовки, осенние кроссовки, осенняя обувь мужская, кроссовки оригинал, кроссовки для бега, new кроссовки, кроссовки нью, оригинальные кроссовки, модели кроссовок, где купить кроссовки, купить сезонные кроссовки, спортивная обувь, топ кроссовок, новая обувь кроссовки",
  },
  {
    id: "timberland-women-shoes",
    brands: ["timberland", "тимберленд", "тимберы"],
    boardKinds: ["обувь"],
    audience: "women",
    cta: "жми «Перейти», больше ассортимента в моем тг-канале @kupim_v_usa",
    keywords:
      "женская обувь, босоножки, летняя обувь, кеды, ботинки, кроссовки женские, обувь на платформе, повседневная обувь, удобная женская обувь, стильная женская обувь на каждый день, брендовая обувь, модная женская обувь 2026 и 2026, трендовая женская обувь, модная обувь весна 2026, модная обувь лето 2026, модная обувь осень 2026, модная обувь зима 2026, трендовая обувь, nike, adidas, new balance, tommy hilfiger, ck, обувь без каблука, базовая женская обувь, модная женская обувь, оригинальные бренды, стиль old money, Тимберленды женские, Тимберленды женские с чем носить, Ботинки Тимберленды женские, Timberland женская обувь, Timberland fashion, женские кроссовки Timberland, женские челси Timberland, женская рабочая обувь Timberland, Timberland женская обувь купить, Timberland аутфит, Timberland outfit",
  },
  {
    id: "calvin-klein-glasses",
    brands: ["calvin klein"],
    boardKinds: ["очки"],
    types: ["очки"],
    cta: CTA_ASSORTIMENT,
    keywords:
      "Женские и мужские солнцезащитные очки, солнечные очки, очки 2026, очки 2026 трендовые, очки из сша, оригинальные солнечные очки из сша, модные очки от американских брендов, подборка брендовых очков с доставкой, как выбрать очки оригинального бренда, солнечные очки эстетика, квадратные очки, овальные очки, очки унисекс, минималистичные очки, очки для лета, стильные солнцезащитные очки 2026, очки Versace, очки Ray Ban, очки Calvin Klein, Солнцезащитные очки Calvin Klein, Оправы Calvin Klein, Calvin Klein очки унисекс, Calvin Klein стильные очки, Calvin Klein ck очки",
  },
  {
    id: "karl-lagerfeld-glasses",
    brands: ["karl lagerfeld", "карл лагерфельд"],
    boardKinds: ["очки"],
    types: ["очки"],
    cta: CTA_ASSORTIMENT,
    keywords:
      "Женские и мужские солнцезащитные очки, солнечные очки, очки 2026, очки 2026 трендовые, очки из сша, оригинальные солнечные очки из сша, модные очки от американских брендов, подборка брендовых очков с доставкой, как выбрать очки оригинального бренда, солнечные очки эстетика, квадратные очки, овальные очки, очки унисекс, минималистичные очки, очки для лета, стильные солнцезащитные очки 2026, очки Versace, очки Ray Ban, очки Calvin Klein, очки Karl Lagerfeld, Karl Lagerfeld солнцезащитные очки, Оправы Karl Lagerfeld, Karl Lagerfeld очки унисекс, Karl Lagerfeld стильные очки",
  },
  {
    id: "tommy-men-clothes",
    brands: ["tommy hilfiger", "томми хилфигер"],
    boardKinds: ["одежда", "куртки", "купальник"],
    audience: "men",
    cta: CTA_ASSORTIMENT,
    keywords:
      "Мужская одежда, футболки мужские, шорты мужские, поло мужское, толстовки мужские, джинсы мужские, худи мужские, спортивный стиль, мужская мода 2026, стильная мужская одежда, футболки и худи от брендов сша, где купить оригинальные мужские футболки, tommy hilfiger, ck, ralph lauren, брендовые толстовки, мужские луки, американская мужская одежда, что надеть мужчине, Tommy Hilfiger мужская одежда, Tommy Hilfiger для мужчин, Tommy Hilfiger men, Томми Хилфигер мужское, Tommy Hilfiger футболки, Tommy Hilfiger поло, Tommy Hilfiger рубашки, Tommy Hilfiger джинсы, Tommy Hilfiger свитшоты, Tommy Hilfiger худи, Tommy Hilfiger casual мужское, Tommy Hilfiger костюмы, томми хилфигер, tommy hilfiger аутфит, tommy hilfiger casual",
  },
  {
    id: "tommy-women-clothes",
    brands: ["tommy hilfiger", "томми хилфигер"],
    boardKinds: ["одежда", "куртки", "купальник"],
    audience: "women",
    cta: "жми «Перейти», чтобы просмотреть весь ассортимент",
    keywords:
      "Женская оригинальная брендовая одежда, женские футболки майки, женские шорты, женские джинсы, женские костюмы, женские рубашки, женские брюки, женские платья, женский комбинезон, женский лонгслив, брендовая одежда 2026, трендовые женские модели 2026, женский стиль 2026, как составить капсульный гардероб женский, летние образы, осенние образы, nike, adidas, new balance, tommy hilfiger, ck, томми хилфигер, женская одежда tommy hilfiger, tommy hilfiger женская мода, стиль tommy hilfiger, tommy hilfiger outfits, томми хилфигер образы, платья tommy hilfiger, tommy hilfiger юбки, tommy hilfiger футболки, tommy hilfiger джинсы женские, tommy hilfiger топы, tommy hilfiger блузы, Tommy Hilfiger женские футболки, tommy hilfiger женские поло",
  },
  {
    id: "tommy-bags",
    brands: ["tommy hilfiger", "томми хилфигер"],
    boardKinds: ["сумки"],
    types: ["сумка", "рюкзак"],
    cta: CTA_ASSORTIMENT,
    keywords:
      "женские сумки и рюкзаки, мужские сумки и рюкзаки, стильные сумки, брендовые рюкзаки, сумки из сша, оригинальные сумки, модные сумки, сумки на каждый день, брендовые вещи из сша, как выбрать оригинальную сумку, лучшие женские сумки 2026, сумки 2026 тренд, подборка сумок из сша оригинал, брендовые сумки оригинал, сумки для лета, сумки для осени, сумки для зимы, универсальные сумки, Tommy Hilfiger рюкзак, рюкзак Tommy Hilfiger мужской, рюкзак Tommy Hilfiger женский, женская сумка Tommy Hilfiger, мужская сумка Tommy Hilfiger, Tommy Hilfiger сумка через плечо, Сумка Tommy Hilfiger с логотипом, Tommy Hilfiger сумка, сумка кроссбоди Tommy Hilfiger, сумка-шоппер Tommy Hilfiger, Tommy Hilfiger спортивная сумка, сумка с логотипом Tommy Hilfiger",
  },
  {
    id: "adidas-spezial",
    brands: ["adidas", "адидас"],
    boardKinds: ["обувь"],
    types: ["кроссовки", "кеды"],
    models: ["spezial", "шпециал"],
    cta: CTA_ASSORTIMENT,
    keywords:
      "Кроссовки женские и мужские, купить кроссовки, кроссовки adidas, шоколадные кроссовки, летние кроссовки, весенние кроссовки, осенние кроссовки, осенняя обувь мужская, кроссовки оригинал, кроссовки для бега, оригинальные кроссовки, модели кроссовок, где купить кроссовки, купить сезонные кроссовки, спортивная обувь, топ кроссовок, новая обувь кроссовки, стильная обувь мужская, трендовая женская обувь, модная обувь весна 2026, модная обувь лето 2026, модная обувь осень 2026, модная обувь зима 2026, трендовая обувь, женские Adidas Handball Spezial, Adidas Spezial кроссовки, Adidas Spezial оригинал, Adidas Spezial замша, Adidas Spezial ретро, adidas spezial кроссовки",
  },
  {
    id: "adidas-gazelle",
    brands: ["adidas", "адидас"],
    boardKinds: ["обувь"],
    types: ["кроссовки", "кеды"],
    models: ["gazelle", "газель"],
    keywords:
      "Кроссовки женские и мужские, купить кроссовки, кроссовки adidas, кроссовки Adidas Gazelle, Адидас газель, мужские кроссовки Adidas, стиль Adidas Gazelle, кеды Adidas Gazelle, Adidas Gazelle outfit, красные Adidas Gazelle, розовые Adidas Gazelle, кэжуал наряды, уличный стиль, модные кроссовки, стильные наряды, минимализм, спортивный стиль, околофутбольная эстетика, adidas gazelle купить, adidas gazelle оригинал, adidas gazelle замша, adidas gazelle мужские, adidas gazelle женские, adidas gazelle 2024, adidas gazelle ретро, adidas gazelle цена, adidas gazelle москва, adidas gazelle синие, adidas gazelle белые, adidas gazelle кеды, adidas gazelle стиль, gazelle adidas в России, adidas gazelle санкт-петербург, кеды adidas gazelle bold, adidas gazelle замшевые кроссовки, adidas gazelle коллаборация",
  },
  {
    id: "jacquemus-panama",
    brands: ["jacquemus"],
    types: ["панама"],
    boardKinds: ["аксессуары"],
    nameIncludes: ["панама", "le bob", "artichaut"],
    keywords:
      "панама Jacquemus, панама хлопковая Jacquemus, Jacquemus Le Bob Artichaut, панама Jacquemus коричневая, Jacquemus панама унисекс, Jacquemus хлопок панама, Jacquemus трендовая панама, панама Jacquemus образы, панама jacquemus лето, панама jacquemus стиль",
  },
  {
    id: "lacoste-sneakers",
    brands: ["lacoste", "лакост"],
    boardKinds: ["обувь"],
    types: ["кроссовки", "кеды"],
    cta: "Где купить такие кроссовки? Жми «Перейти», вся информация в канале!",
    keywords:
      "Кроссовки женские и мужские, купить кроссовки, кроссовки Lacoste, белые кроссовки, летние кроссовки, весенние кроссовки, осенние кроссовки, осенняя обувь, кроссовки оригинал, кроссовки для бега, оригинальные кроссовки, модели кроссовок, где купить кроссовки, спортивная обувь, топ кроссовок, стильные кроссовки, кроссовки Lacoste, кеды Lacoste, оригинальные кроссовки Lacoste, кроссовки Lacoste L1212, мужская обувь Lacoste, женская обувь Lacoste, Lacoste спортивная обувь, летние кроссовки Lacoste, Lacoste sneakers, кроссовки Лакост, купить Lacoste кроссовки, кроссовки Lacoste L001, кроссовки Lacoste унисекс",
  },
  {
    id: "lacoste-women-clothes",
    brands: ["lacoste", "лакост"],
    boardKinds: ["одежда", "куртки", "купальник"],
    audience: "women",
    cta: "Жми «Перейти» и узнай где купить одежду LACOSTE по выгодной цене",
    keywords:
      "Женская оригинальная брендовая одежда, женские футболки майки, женские шорты, женские джинсы, женские костюмы, женские рубашки, женские брюки, женские платья, женский комбинезон, женский лонгслив, брендовая одежда 2026, трендовые женские модели 2026, женский стиль 2026, как составить капсульный гардероб женский, летние образы, осенние образы, nike, adidas, new balance, tommy hilfiger, ck, томми хилфигер, Lacoste женская одежда, женские футболки Lacoste, женские поло Lacoste, женские свитшоты Lacoste, женские платья Lacoste, женские худи Lacoste, Lacoste женские кроссовки, Lacoste для женщин, Lacoste casual, Lacoste поло женское, Lacoste аутфит, Lacoste стиль",
  },
  {
    id: "ray-ban-glasses",
    brands: ["ray-ban", "ray ban", "рей бен"],
    boardKinds: ["очки"],
    types: ["очки"],
    cta: "Где купить такие очки по классной цене? Жми «Перейти», вся информация в канале!",
    keywords:
      "Женские и мужские солнцезащитные очки, солнечные очки, очки 2026, очки 2026 трендовые, очки из сша, оригинальные солнечные очки из сша, модные очки от американских брендов, подборка брендовых очков с доставкой, как выбрать очки оригинального бренда, солнечные очки эстетика, квадратные очки, овальные очки, очки унисекс, минималистичные очки, очки для лета, стильные солнцезащитные очки 2026, Versace, Ray Ban, очки Ray-Ban Aviator, Ray-Ban оригинал, Ray-Ban солнцезащитные очки, Ray-Ban купить",
  },
  {
    id: "zara-men-clothes",
    brands: ["zara", "зара"],
    boardKinds: ["одежда", "куртки"],
    audience: "men",
    cta: "Хочешь себе стильный лук от ZARA, но не знаешь где приобрести? - жми «Перейти» вся информация уже в канале",
    keywords:
      "Мужская одежда, футболки мужские, шорты мужские, поло мужское, толстовки мужские, джинсы мужские, худи мужские, спортивный стиль, мужская мода 2026, стильная мужская одежда, футболки и худи от брендов сша, где купить оригинальные мужские футболки, tommy hilfiger, ck, ralph lauren, брендовые толстовки, мужские луки, американская мужская одежда, что надеть мужчине, мужская одежда Zara, Zara мужская коллекция, мужские пальто Zara, мужские куртки Zara, мужские худи Zara, мужские свитера Zara, мужские брюки Zara, мужские джинсы Zara, пиджак Zara, Zara мужской стиль, Zara мужской look, Zara мужская одежда casual",
  },
  {
    id: "gucci-bags",
    brands: ["gucci", "гуччи"],
    boardKinds: ["сумки"],
    types: ["сумка", "рюкзак"],
    cta: CTA_ASSORTIMENT,
    keywords:
      "женские сумки и рюкзаки, мужские сумки и рюкзаки, стильные сумки, брендовые рюкзаки, сумки из сша, оригинальные сумки, модные сумки, сумки на каждый день, брендовые вещи из сша, как выбрать оригинальную сумку, лучшие женские сумки 2026, сумки 2026 тренд, подборка сумок из сша оригинал, брендовые сумки оригинал, сумки для лета, сумки для осени, сумки для зимы, универсальные сумки, Стильные женские сумки из США, Gucci сумки, Сумка Gucci, Сумки Gucci, Винтажная сумка Gucci, Брендовые сумки Gucci, Gucci сумки 2026, Сумка Gucci Marmont, Модные сумки Gucci через плечо",
  },
  {
    id: "gucci-cosmetics",
    brands: ["gucci", "гуччи"],
    boardKinds: ["косметика"],
    cta: CTA_ASSORTIMENT,
    keywords:
      "косметика Gucci, Gucci Beauty, помада Gucci, помада для губ Gucci, Gucci Rouge, Gucci lipstick, блеск для губ Gucci, бальзам для губ Gucci, макияж Gucci, гуччи косметика, оригинальная косметика Gucci, купить помаду Gucci, помада Gucci оригинал, красная помада Gucci, нюдовая помада Gucci, матовая помада Gucci, сатиновая помада Gucci, Gucci Rouge de Beauté, косметика из сша, макияж 2026, брендовая косметика, косметика для губ, губная помада Gucci, Gucci makeup, Gucci Cosmetics",
  },
  {
    id: "furla-bags",
    brands: ["furla", "фурла"],
    boardKinds: ["сумки"],
    types: ["сумка", "рюкзак"],
    cta: "Жми «Перейти» и узнай где купить сумки Furla по выгодной цене!",
    keywords:
      "женские сумки и рюкзаки, мужские сумки и рюкзаки, стильные сумки, модные сумки, брендовые рюкзаки, сумки из сша, оригинальные сумки, модные сумки, сумки на каждый день, брендовые вещи из сша, как выбрать оригинальную сумку, лучшие женские сумки 2026, сумки 2026 тренд, подборка сумок из сша оригинал, брендовые сумки оригинал, сумки для лета, сумки для осени, сумки для зимы, универсальные сумки, сумки furla, сумки Furla, стильные сумки Furla, Furla Metropolis, Furla клатчи, сумки Furla кожаные, сумка Furla шоппер, Furla оригинал, Furla женская сумка, Furla аксессуары, Furla весна-лето 2026",
  },
  {
    id: "rhode",
    brands: ["rhode"],
    cta: "Хочешь себе косметику бренда Rhode, но не знаешь, где приобрести? - жми «Перейти» вся информация уже в ТГ-канале!",
    keywords:
      "Rhode, косметика Rhode, уход за кожей Rhode, бальзам Rhode, пептидные бальзамы Rhode, прозрачные бальзамы Rhode, румяна Rhode, минималистичная косметика Rhode, косметика Хейли Бибер, блеск для губ Rhode, корректор Rhode, косметика с пептидами Rhode, купить Rhode в России, Rhode доставка в Россию, оригинальная косметика Rhode, Rhode отзывы, rhode макияж, карандаш для губ Rhode, блеск для губ Rhode, Rhode уход за кожей, Rhode blush, Rhode beauty, Hailey Bieber Rhode, Rhode makeup, Rhode бьюти, Rhode girl aesthetic, Rhode sleepy girl blush, чехол Rhode, чехол для телефона Rhode, чехол для айфона Rhode",
  },
  {
    id: "armani-cosmetics",
    brands: ["giorgio armani", "armani beauty", "armani", "джорджио армани", "армани"],
    boardKinds: ["косметика"],
    cta: CTA_CHANNEL,
    keywords:
      "косметика Armani, Giorgio Armani Beauty, тональная основа Armani, тональный крем Armani, Armani Luminous Silk, Armani Power Fabric, Armani Maestro, Armani foundation, консилер Armani, пудра Armani, макияж Armani, уход за кожей Armani, Armani beauty, джорджио армани косметика, оригинальная косметика Armani, купить Armani косметику, тональная основа для лица Armani, люминос силк, армани макияж, косметика из сша, уход за лицом, тональный крем, Giorgio Armani makeup, Armani Cosmetics, сияющая кожа, макияж 2026, брендовая косметика, косметика для лица",
  },
  {
    id: "ugg",
    brands: ["ugg"],
    keywords:
      "женские угги, угги мини, угги классические, угги короткие, угги высокие, угги на платформе, угги с пуговицей, вязаные угги, мокасины с мехом UGG, кожаные угги, тапочки на меху, угги с ремнями и молниями, угги с пайетками, эксклюзивные угги, UGG Tasman Slippers, UGG Ultra мини, распродажа UGG, мужские угги, зимние ботинки UGG, мужские сапоги UGG, ugg мужская обувь, ugg женская обувь, купить угги, угги original, угги натуральные, угги замша, ugg boots men, ugg boots women, зимняя обувь угги, стильные угги, удобные угги, мужские ботинки ugg, женские сапоги ugg, Ugg Tazz, сандалии Ugg",
  },
  {
    id: "karl-lagerfeld-bags",
    brands: ["karl lagerfeld", "карл лагерфельд"],
    boardKinds: ["сумки"],
    types: ["сумка", "рюкзак"],
    cta: "Где купить такую сумку? Жми «Перейти», вся информация в канале",
    keywords:
      "женские сумки и рюкзаки, мужские сумки и рюкзаки, стильные сумки, модные сумки, брендовые рюкзаки, сумки из сша, оригинальные сумки, модные сумки, сумки на каждый день, брендовые вещи из сша, как выбрать оригинальную сумку, лучшие женские сумки 2026, сумки 2026 тренд, подборка сумок из сша оригинал, брендовые сумки оригинал, сумки для лета, сумки для осени, сумки для зимы, универсальные сумки, Karl Lagerfeld сумки, сумка Karl Lagerfeld, сумка карл лагерфельд, сумка Karl Lagerfeld оригинал, сумка Karl Lagerfeld кросс-боди, сумка Karl Lagerfeld мини, женская сумка Karl Lagerfeld, модные сумки Karl Lagerfeld, сумка через плечо Karl Lagerfeld, Karl Lagerfeld аксессуары, Karl Lagerfeld кожаная сумка, Karl Lagerfeld tote сумка, Karl Lagerfeld чемодан",
  },
  {
    id: "stanley",
    brands: ["stanley"],
    cta: "Где купить такой термос? Жми «Перейти», вся информация в канале",
    keywords:
      "кружка, термокружка, Stanley, термокружка Stanley, стильные аксессуары 2026, термокружка с собой, брендовые вещи из сша, лучшие аксессуары 2026, аутфит с stanley, брендовые вещи оригинал, original brands, USA fashion accessories, nike, adidas, new balance, tommy hilfiger, ck, guess, karl lagerfeld, marc jacobs, stanley aesthetic, stanley термос, stanley термокружка, stanley tumbler, термос stanley classic, термокружка stanley quencher, термосы стильные stanley, stanley термос 1 литр, stanley термос 1.9 л, stanley термос нержавейка, stanley подарок, stanley аксессуары, stanley кружка из нержавейки, термосы stanley купить, stanley походный термос, stanley travel mug, stanley термос оригинал, термосы и кружки stanley",
  },
  {
    id: "michael-kors",
    brands: ["michael kors", "майкл корс"],
    cta: CTA_CHANNEL,
    keywords:
      "сумки, сумки michael kors, майкл корс, магазин майкл корс, мк сумки, сумки mk, майкл корс эстетика, майкл корс одежда, модный показ майкл корс, майкл корс стиль, летние рубашки майкл корс, сумка Michael Kors, michael kors сумки, купить сумку Michael Kors, сумки MK, оригинальные сумки Michael Kors, стильные сумки Michael Kors, мужская одежда Michael Kors, женская одежда Michael Kors, Michael Kors мужская коллекция, Michael Kors женская коллекция, Майкл Корс мужская мода, Майкл Корс женская мода, Костюмы Michael Kors мужские, Платья Michael Kors женские, Michael Kors осенний гардероб, Michael Kors зимняя коллекция, Michael Kors летняя одежда, Michael Kors стильная одежда, Michael Kors casual мужская, Michael Kors casual женская",
  },
  {
    id: "banana-republic",
    brands: ["banana republic", "банана репаблик"],
    cta: CTA_CHANNEL,
    keywords:
      "мужская одежда Banana Republic, мужской стиль кэжуал, рубашка с длинным рукавом, мужские повседневные наряды, ретро стиль, верхняя одежда, стильные мужчины, мужской стиль, мужской fashion, блейзер, женская одежда Banana Republic, деловой стиль, casual, повседневная одежда, одежда для работы и отдыха, стильная женская одежда, Banana Republic, Банана Репаблик, Banana Republic одежда, Banana Republic стиль, Banana Republic мужчины, Banana Republic женщины, Banana Republic коллекция, Banana Republic мода, Banana Republic весна, Banana Republic лето, Banana Republic casual, Banana Republic лук",
  },
  {
    id: "calvin-klein-clothes",
    brands: ["calvin klein"],
    boardKinds: ["одежда", "куртки", "купальник", "сумки", "аксессуары", "белье"],
    types: ["сумка", "рюкзак", "панама", "термос"],
    cta: CTA_CHANNEL,
    keywords:
      "Calvin Klein одежда, Calvin Klein верхняя одежда, Calvin Klein сумки, Calvin Klein аксессуары, Calvin Klein куртки, Calvin Klein пальто, Calvin Klein платья, Calvin Klein джинсы, Calvin Klein кошельки, Calvin Klein рюкзаки, Calvin Klein ремни, Calvin Klein стиль, Calvin Klein мода, Calvin Klein коллекция, Calvin Klein женская одежда, Calvin Klein мужская одежда, Calvin Klein casual, Calvin Klein лук, Calvin Klein официальный, женские сумки и рюкзаки, мужские сумки и рюкзаки, Calvin Klein футболка, Calvin Klein свитер, Calvin Klein толстовка, набор стринг Calvin Klein, нижее белье Calvin Klein, женское нижнее белье Calvin Klein, мужское белье Calvin Klein, боксеры Calvin Klein",
  },
  {
    id: "us-polo",
    brands: ["u.s. polo assn", "us polo assn", "u.s. polo", "us polo"],
    boardKinds: ["одежда", "куртки", "купальник", "сумки", "аксессуары", "обувь"],
    cta: CTA_CHANNEL,
    keywords:
      "женская одежда, мужская одежда, аксессуары, бренд U.S. Polo ASSN, футболки U.S. Polo ASSN, поло U.S. Polo ASSN, сумки U.S. Polo ASSN, кепки U.S. Polo ASSN, стиль U.S. Polo ASSN, оригинальная одежда U.S. Polo ASSN, одежда U.S. Polo ASSN, U.S. Polo ASSN, U.S. Polo ASSN одежда, купить U.S. Polo ASSN одежду, модная одежда U.S. Polo ASSN, U.S. Polo ASSN топы, U.S. Polo ASSN куртки, U.S. Polo ASSN обувь, U.S. Polo ASSN бренд одежда, U.S. Polo ASSN сумки, U.S. Polo ASSN аксессуары, мужское поло U.S. Polo ASSN, свитер джемпер U.S. Polo ASSN, рубашка U.S. Polo ASSN",
  },
  {
    id: "moon-boot",
    brands: ["moon boot", "moon boots", "moonboots"],
    cta: CTA_CHANNEL,
    keywords:
      "moon boots, moonboots, обувь moon boots, зимняя обувь, зимние сапоги, теплые сапоги, стиль moon boots, модная зимняя обувь, пуховые сапоги, обувь для снега, бренд moon boots, Moon Boot, луноходы, мунбуты, обувь Moon Boot, сапоги Moon Boot, зимние ботинки Moon Boot, Moon Boot женские, Moon Boot мужские, Moon Boot детские, дутики Moon Boot, лунные ботинки, Moon Boot купить, Moon Boot оригинал, Moon Boot цена, Moon Boot отзывы, Moon Boot водонепроницаемые, Moon Boot теплые, Moon Boot с мехом, Moon Boot с утеплителем, Moon Boot для снега, Moon Boot с шнурками, Moon Boot на шнуровке, Moon Boot легкие",
  },
  {
    id: "longchamp-bags",
    brands: ["longchamp", "лоншамп"],
    boardKinds: ["сумки"],
    types: ["сумка", "рюкзак"],
    cta: CTA_CHANNEL,
    keywords:
      "женские сумки и рюкзаки, мужские сумки и рюкзаки, стильные сумки, модные сумки, брендовые рюкзаки, сумки из сша, оригинальные сумки, модные сумки, сумки на каждый день, брендовые вещи из сша, как выбрать оригинальную сумку, лучшие женские сумки 2026, сумки 2026 тренд, подборка сумок из сша оригинал, брендовые сумки оригинал, сумки для лета, сумки для осени, сумки для зимы, универсальные сумки, сумка Longchamp, сумки Longchamp оригинал, сумка Longchamp Le Pliage, longchamp сумки, сумка лоншамп, лоншамп сумка купить, сумка Longchamp женская, Longchamp Le Pliage сумка, лоншамп оригинал, стильные сумки Longchamp, сумка Longchamp плетеная, longchamp рюкзак, купить сумку Longchamp, Longchamp бренд сумок",
  },
  {
    id: "cosmetics",
    boardKinds: ["косметика"],
    nameIncludes: [
      "крем",
      "сыворотка",
      "помада",
      "румяна",
      "блеск",
      "тональный",
      "тональная",
      "бальзам",
      "косметика",
      "макияж",
      "корректор",
      "карандаш для губ",
    ],
    cta: CTA_CHANNEL,
    keywords:
      "рутинный уход за кожей тела, уход за телом, косметика для ежедневного пользования, косметика, уход за кожей, бьюти-рутин, SPF, уход за лицом, натуральная косметика, органическая косметика, косметика для разных типов кожи, макияж, косметические средства, уходовые средства, румяна, брови, уход за волосами, стайлинг, красота, эстетика, косметические тренды, estee lauder уход за кожей, эсте лаудер, estee lauder тональный крем, estee lauder сыворотка, estee lauder макияж, estee lauder помада, estee lauder отзывы, clinique косметика, clinique уход для лица, clinique тональный крем, clinique сыворотка, clinique крем для лица, clinique отзывы, lancome косметика, lancome тональный крем, lancome помада, lancome уход за кожей, lancome отзывы, lancome макияж, mac косметика, mac помада, mac тональный крем, mac для визажистов, mac makeup, mac макияж, mac отзывы, yves saint laurent косметика, ysl помада, ysl тональный крем, ysl макияж, ysl уход за кожей, ysl отзывы",
  },
  {
    id: "hugo-boss",
    brands: ["hugo boss"],
    cta: CTA_CHANNEL,
    keywords:
      "одежда Hugo Boss, обувь Hugo Boss, брендовая одежда, брендовая обувь, мужская одежда Hugo Boss, женская одежда Hugo Boss, кроссовки Hugo Boss, аксессуары Hugo Boss, деловой стиль, офисная одежда, casual Hugo Boss, спортивная обувь Hugo Boss, туфли Hugo Boss, лоферы Hugo Boss, модные луки Hugo Boss, Hugo boss верхняя одежда, ремень Hugo Boss, куртки Hugo Boss, толстовки Hugo Boss, худи Hugo Boss, спортивный костюм Hugo Boss, мужское нижнее белье Hugo Boss, трусы Hugo Boss",
  },
  {
    id: "the-north-face",
    brands: ["the north face", "north face"],
    cta: "Выделяйся среди других в оригинальных брендах вместе с @kupim_v_usa, жми «Перейти»",
    keywords:
      "The North Face одежда, термобелье The North Face, куртки The North Face, The North Face пуховик, The North Face мужская одежда, The North Face женская одежда, The North Face стиль, спортивная одежда The North Face, верхняя одежда The North Face, The North Face аутдор, стильные куртки The North Face, зимняя одежда The North Face, ветрозащитные куртки The North Face, the north face россия, the north face кружка, спорт, туризм, зимняя одежда, пуховик the north face, флиска, горнолыжка, стиль, спортивная одежда, ветровка the north face",
  },
]);

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[''`´.]/g, "")
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function productText(product) {
  if (!product || typeof product !== "object") return "";
  return normalize([product.name, product.model, product.type].filter(Boolean).join(" "));
}

function aliasMatches(text, alias) {
  const hay = normalize(text);
  const needle = normalize(alias);
  if (!hay || !needle) return false;
  if (hay === needle) return true;
  if (needle.length < 3) return false;
  return hay.includes(needle);
}

function brandMatches(brand, aliases) {
  return (aliases || []).some((alias) => aliasMatches(brand, alias));
}

function hasBrandConstraint(entry) {
  return Boolean(entry.brands && entry.brands.length);
}

function hasCategoryConstraint(entry) {
  return Boolean(
    (entry.boardKinds && entry.boardKinds.length) ||
      (entry.types && entry.types.length) ||
      (entry.nameIncludes && entry.nameIncludes.length)
  );
}

function categoryMatches(product, entry) {
  if (!hasCategoryConstraint(entry)) return true;
  const kind = product && product.boardKind;
  const type = product && product.type;
  const hay = productText(product);
  if (entry.boardKinds && kind && entry.boardKinds.includes(kind)) return true;
  if (entry.types && type && entry.types.includes(type)) return true;
  if (entry.nameIncludes && entry.nameIncludes.some((word) => aliasMatches(hay, word))) return true;
  return false;
}

function modelMatches(product, entry) {
  if (!entry.models || !entry.models.length) return true;
  const hay = productText(product);
  return entry.models.some((model) => aliasMatches(hay, model));
}

function ruleFits(entry, ctx) {
  if (hasBrandConstraint(entry) && !brandMatches(ctx.brand, entry.brands)) return false;
  if (entry.audience && ctx.audienceKey !== entry.audience) return false;
  if (!modelMatches(ctx.product, entry)) return false;
  if (!categoryMatches(ctx.product, entry)) return false;
  return true;
}

function score(entry) {
  let value = 0;
  if (entry.models && entry.models.length) value += 4;
  if (hasCategoryConstraint(entry)) value += 3;
  if (entry.audience) value += 2;
  if (hasBrandConstraint(entry)) value += 1;
  return value;
}

function formatDescription(entry) {
  const cta = String((entry && entry.cta) || "")
    .replace(/Открыть веб-сайт/g, CTA_BUTTON)
    .trim();
  const keywords = String((entry && entry.keywords) || "").trim();
  if (cta && keywords) return `${cta}\n\n${keywords}`;
  return keywords || cta || MISSING_DESCRIPTION;
}

function bestMatch(entries, ctx) {
  let best = null;
  let bestScore = -1;
  let bestId = "";
  for (const entry of entries) {
    if (!ruleFits(entry, ctx)) continue;
    const value = score(entry);
    const id = String(entry.id || "");
    if (value > bestScore || (value === bestScore && id < bestId)) {
      best = entry;
      bestScore = value;
      bestId = id;
    }
  }
  return best;
}

const BRANDED_RULES = DESCRIPTIONS.filter(hasBrandConstraint);
const GENERIC_RULES = DESCRIPTIONS.filter((entry) => !hasBrandConstraint(entry));
const BRANDED_ALIASES = BRANDED_RULES.flatMap((entry) => entry.brands);

function inferDescription({ brand, product, audience } = {}) {
  const ctx = {
    brand: brand || "",
    product: product || {},
    audienceKey: audience && audience.key,
  };
  const brandedHit = bestMatch(BRANDED_RULES, ctx);
  if (brandedHit) return formatDescription(brandedHit);
  if (brandMatches(ctx.brand, BRANDED_ALIASES)) {
    return MISSING_DESCRIPTION;
  }
  const genericHit = bestMatch(GENERIC_RULES, ctx);
  if (genericHit) return formatDescription(genericHit);
  return MISSING_DESCRIPTION;
}

module.exports = {
  DESCRIPTIONS,
  MISSING_DESCRIPTION,
  inferDescription,
};
